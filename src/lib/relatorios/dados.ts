/**
 * Carregador dos relatórios: lê o banco para um grupo de turma (escola + nome + ano letivo, todos os
 * bimestres) e entrega os objetos prontos para as páginas e para a Hermes, usando os cálculos puros.
 * A permissão fica com quem chama (página: `exigirTurmaDaEscola`; Hermes: `podeVerGrupo`).
 * Colunas sempre explícitas: nunca `senha_hash`, `token_verificacao*` nem `codigo_convite*`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaAluno, mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { estadoAula, porcentagemAula } from "@/lib/aulas/progresso";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { emBlocos, tempoDeProvaSeg } from "@/lib/simulados/regras";
import type { ValorCelula } from "@/lib/status";
import type { GrupoTurma } from "./acesso";
import {
  acertoPorMateria, agruparAlunoEntreBimestres, atividadesDaLinha, distribuicaoMedias, fraseAluno, fraseTurma, mediaDaTurma, quantoFalta,
  rankingTurma, resumoAulas, situacaoNoSimulado,
} from "./calculos";
import { mediaAprovacaoDaEscola } from "./media";
import type {
  AcertoMateria, AlunoDaTurma, AtividadeAluno, BimestreAluno, LinhaSimuladoAluno, MediaBimestreTurma, RelatorioAluno, RelatorioTurma,
  ResumoAulas, SimuladoDaTurma,
} from "./tipos";

export { grupoDaTurma, podeVerGrupo, type GrupoTurma } from "./acesso";

/** Erro de `carregarRelatorioAluno` quando o alunoId não é uma linha do grupo (a página responde 404). */
export class AlunoForaDoGrupo extends Error {
  constructor() {
    super("Aluno não encontrado nesta turma.");
    this.name = "AlunoForaDoGrupo";
  }
}

// ---------- leitura paginada (cópia pequena de src/lib/mcp/leitura/comum.ts, sem puxar zod/MCP) ----------

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lê todas as páginas (o PostgREST devolve no máximo 1000 linhas por vez). */
async function lerTodas<T>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return todas;
  }
}

/** Quantos blocos de `lerPorIds` são lidos ao mesmo tempo. */
const BLOCOS_EM_PARALELO = 5;

/**
 * Como lerTodas, com a lista de ids em blocos de 100 (limite de URL do `.in()`). Lê até
 * BLOCOS_EM_PARALELO blocos ao mesmo tempo; o resultado sai na ordem dos blocos (determinístico).
 */
async function lerPorIds<T>(ids: string[], montar: (bloco: string[], de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const blocos = emBlocos([...new Set(ids)], 100);
  const lidos: T[][] = new Array(blocos.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < blocos.length) {
      const i = proximo++;
      lidos[i] = await lerTodas<T>((de, ate) => montar(blocos[i], de, ate));
    }
  };
  await Promise.all(Array.from({ length: Math.min(BLOCOS_EM_PARALELO, blocos.length) }, trabalhador));
  return lidos.flat();
}

/** Cliente importado sob demanda: `acesso.ts`/cálculos continuam testáveis sem variáveis de ambiente. */
async function banco(): Promise<SupabaseClient> {
  const { supabase } = await import("@/lib/supabase/client");
  return supabase as unknown as SupabaseClient;
}

// ---------- tipos do que é lido ----------

type TurmaLida = { id: string; bimestre: string; bimestre_vigente: boolean; bimestre_encerrado: boolean };
type Linha = { turmaId: string; bimestre: string; alunoId: string; nome: string };
type Vinculo = { conta_id: string; aluno_id: string | null };
type Conta = { id: string; nome: string; ultimo_acesso: string | null };
type SimuladoLido = { id: string; titulo: string; tipo: "professor" | "treino"; status: string; abre_em: string | null; fecha_em: string | null; created_at: string };
type TentativaLida = {
  id: string; simulado_id: string; conta_id: string; status: string; porcentagem: number | string | null;
  iniciada_em: string; entregue_em: string | null; prazo_em: string | null; tempo_usado_seg: number;
  saidas: number | null; tempo_fora_seg: number | null;
};
type AulaLida = { id: string; curso_id: string; modulo_id: string; titulo: string; ordem: number };
type ProgressoLido = { conta_id: string; aula_id: string; maior_posicao_seg: number; duracao_seg: number | null; concluida_em: string | null };
type RespostaLida = { materia: string | null; correta: boolean | null; anulada: boolean };
type ColunaLida = { id: string; turma_id: string; titulo: string; tipo: string; ordem: number };

const COLUNAS_SIMULADO = "id, titulo, tipo, status, abre_em, fecha_em, created_at";
const COLUNAS_TENTATIVA = "id, simulado_id, conta_id, status, porcentagem, iniciada_em, entregue_em, prazo_em, tempo_usado_seg, saidas, tempo_fora_seg";

const m10 = (m: number | null) => (m === null ? null : paraEscala10(m));

/** Ano (no fuso de São Paulo) de uma data ISO, para os treinos do ano letivo. */
const anoSP = (iso: string) => new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date(iso));

/**
 * Janela larga (UTC) para filtrar no banco as tentativas de um ano: um dia de folga de cada lado cobre
 * o fuso de São Paulo; o corte exato continua sendo `anoSP` no código.
 */
function janelaDoAno(ano: number): { de: string; ate: string } {
  return { de: new Date(Date.UTC(ano - 1, 11, 31)).toISOString(), ate: new Date(Date.UTC(ano + 1, 0, 2)).toISOString() };
}

// ---------- base: planilhas do grupo e contas ligadas ----------

type Base = {
  db: SupabaseClient;
  g: GrupoTurma;
  media: number;
  turmas: TurmaLida[];
  linhas: Linha[];
  /** alunoId → colunaId → célula (mesmo formato da tela da turma: todas as células do aluno). */
  celulas: Record<string, Record<string, ValorCelula>>;
  vinculos: Vinculo[];
  contas: Map<string, Conta>;
  /** Colunas (atividades) das planilhas do grupo, em ordem de `ordem`. */
  colunas: ColunaLida[];
};

async function carregarBase(g: GrupoTurma): Promise<Base> {
  const db = await banco();
  const [media, turmas, vinculos] = await Promise.all([
    mediaAprovacaoDaEscola(g.escolaId),
    lerTodas<TurmaLida>((de, ate) =>
      db.from("turmas").select("id, bimestre, bimestre_vigente, bimestre_encerrado")
        .eq("escola_id", g.escolaId).eq("nome", g.nome).eq("ano_letivo", g.anoLetivo).order("bimestre").order("id").range(de, ate)),
    lerTodas<Vinculo>((de, ate) =>
      db.from("aluno_turmas").select("conta_id, aluno_id")
        .eq("escola_id", g.escolaId).eq("turma_nome", g.nome).eq("ano_letivo", g.anoLetivo).order("conta_id").range(de, ate)),
  ]);
  if (turmas.length === 0) throw new Error("Turma não encontrada.");

  const [alunosLidos, colunas] = await Promise.all([
    lerPorIds<{ id: string; turma_id: string; nome: string; ordem: number }>(turmas.map((t) => t.id), (bloco, de, ate) =>
      db.from("alunos").select("id, turma_id, nome, ordem").in("turma_id", bloco).order("ordem").order("id").range(de, ate)),
    lerPorIds<ColunaLida>(turmas.map((t) => t.id), (bloco, de, ate) =>
      db.from("atividades_colunas").select("id, turma_id, titulo, tipo, ordem").in("turma_id", bloco).order("ordem").order("id").range(de, ate)),
  ]);
  const bimestreDe = new Map(turmas.map((t) => [t.id, t.bimestre]));
  const linhas: Linha[] = alunosLidos.map((a) => ({ turmaId: a.turma_id, bimestre: bimestreDe.get(a.turma_id) ?? "", alunoId: a.id, nome: a.nome }));

  // Igual à tela da turma: as células são lidas pelos alunos (todas as colunas) e a média é mediaAluno.
  const [notas, contasLidas] = await Promise.all([
    lerPorIds<{ aluno_id: string; coluna_id: string; valor: number | string | null; status_texto: string | null }>(linhas.map((l) => l.alunoId), (bloco, de, ate) =>
      db.from("notas_celulas").select("aluno_id, coluna_id, valor, status_texto").in("aluno_id", bloco).order("id").range(de, ate)),
    lerPorIds<Conta>(vinculos.map((v) => v.conta_id), (bloco, de, ate) =>
      db.from("alunos_contas").select("id, nome, ultimo_acesso").in("id", bloco).order("id").range(de, ate)),
  ]);
  const celulas: Base["celulas"] = {};
  for (const n of notas) (celulas[n.aluno_id] ??= {})[n.coluna_id] = { valor: n.valor === null ? null : Number(n.valor), status_texto: n.status_texto };

  const contas = new Map(contasLidas.map((c) => [c.id, c]));
  return { db, g, media, turmas, linhas, celulas, vinculos: vinculos.filter((v) => contas.has(v.conta_id)), contas, colunas };
}

// ---------- a pessoa: linhas em vários bimestres + conta ----------

type Pessoa = { alunoId: string; nome: string; alunoIds: Set<string>; parcial: boolean; contaId: string | null; bimestres: BimestreAluno[] };

/**
 * Conta ligada às linhas da pessoa: pelo `aluno_turmas.aluno_id`; sem vínculo, pelo nome normalizado
 * (uma única conta da turma com esse nome, que não esteja ligada a outra linha da planilha).
 * Nome repetido na turma do aluno: só o vínculo vale.
 */
function contaDaPessoa(b: Base, alunoIds: Set<string>, nome: string, nomeRepetido: boolean): string | null {
  const ligada = b.vinculos.find((v) => v.aluno_id && alunoIds.has(v.aluno_id));
  if (ligada) return ligada.conta_id;
  if (nomeRepetido) return null;
  const alvo = normalizarBusca(nome);
  const idsDaPlanilha = new Set(b.linhas.map((l) => l.alunoId));
  const candidatas = b.vinculos.filter((v) =>
    !(v.aluno_id && idsDaPlanilha.has(v.aluno_id)) && normalizarBusca(b.contas.get(v.conta_id)?.nome ?? "") === alvo);
  return candidatas.length === 1 ? candidatas[0].conta_id : null;
}

function montarPessoa(b: Base, alvo: Linha): Pessoa {
  const nomeAlvo = normalizarBusca(alvo.nome);
  const nomeRepetido = b.linhas.filter((l) => l.turmaId === alvo.turmaId && normalizarBusca(l.nome) === nomeAlvo).length > 1;
  const conta0 = contaDaPessoa(b, new Set([alvo.alunoId]), alvo.nome, nomeRepetido);
  const vinculados = new Set(b.vinculos.filter((v) => conta0 && v.conta_id === conta0 && v.aluno_id).map((v) => v.aluno_id as string));
  const { alunoIds, parcial } = agruparAlunoEntreBimestres(b.linhas, { alunoId: alvo.alunoId, nome: alvo.nome }, vinculados);
  const ids = new Set(alunoIds);
  const contaId = conta0 ?? contaDaPessoa(b, ids, alvo.nome, nomeRepetido);
  const bimestres = b.turmas.map((t): BimestreAluno => {
    const linha = t.id === alvo.turmaId ? alvo : b.linhas.find((l) => l.turmaId === t.id && ids.has(l.alunoId));
    return {
      bimestre: t.bimestre,
      turmaId: t.id,
      media: linha ? m10(mediaAluno(b.celulas[linha.alunoId])) : null,
      encerrado: t.bimestre_encerrado,
      vigente: t.bimestre_vigente,
    };
  });
  return { alunoId: alvo.alunoId, nome: alvo.nome, alunoIds: ids, parcial, contaId, bimestres };
}

/** Bimestre que define a lista da turma: o vigente; senão o último com alunos; senão o primeiro. */
function turmaDeReferencia(b: Base): TurmaLida {
  const comAlunos = b.turmas.filter((t) => b.linhas.some((l) => l.turmaId === t.id));
  return b.turmas.find((t) => t.bimestre_vigente) ?? comAlunos.at(-1) ?? b.turmas[0];
}

// ---------- simulados, treinos, respostas e aulas das contas ----------

type Extras = {
  /** Provas do professor do grupo, publicadas e já abertas (as futuras não contam para "não fez"). */
  simulados: SimuladoLido[];
  /** contaId|simuladoId → tentativa (provas do grupo). */
  tentProva: Map<string, TentativaLida>;
  /** Tentativas de treino das contas no ano letivo, com o treino. */
  treinos: { t: TentativaLida; s: SimuladoLido }[];
  /** tentativaId → respostas (só tentativas entregues). */
  respostas: Map<string, RespostaLida[]>;
  /** null = nenhum curso ligado ao grupo. */
  aulas: AulaLida[] | null;
  /** contaId|aulaId → progresso. */
  progresso: Map<string, ProgressoLido>;
};

async function carregarExtras(b: Base, contaIds: string[], agora: Date): Promise<Extras> {
  const { db, g } = b;
  const [sts, cts] = await Promise.all([
    lerTodas<{ simulado_id: string }>((de, ate) =>
      db.from("simulado_turmas").select("simulado_id").eq("escola_id", g.escolaId).eq("turma_nome", g.nome).eq("ano_letivo", g.anoLetivo).order("simulado_id").range(de, ate)),
    lerTodas<{ curso_id: string }>((de, ate) =>
      db.from("curso_turmas").select("curso_id").eq("escola_id", g.escolaId).eq("turma_nome", g.nome).eq("ano_letivo", g.anoLetivo).order("curso_id").range(de, ate)),
  ]);

  const doGrupo = await lerPorIds<SimuladoLido>(sts.map((s) => s.simulado_id), (bloco, de, ate) =>
    db.from("simulados").select(COLUNAS_SIMULADO).in("id", bloco).eq("tipo", "professor").eq("status", "publicado").order("id").range(de, ate));
  const simulados = doGrupo
    .filter((s) => !s.abre_em || Date.parse(s.abre_em) <= agora.getTime())
    .sort((a, c) => (a.abre_em ?? a.created_at).localeCompare(c.abre_em ?? c.created_at) || a.id.localeCompare(c.id));
  const idsProva = new Set(simulados.map((s) => s.id));

  // Duas leituras: as tentativas das provas do grupo e as de treino (com o treino junto, filtradas pelo ano no banco).
  const ano = g.anoLetivo.trim();
  const anoNumerico = /^\d{4}$/.test(ano);
  const janela = anoNumerico ? janelaDoAno(Number(ano)) : null;
  const [tentsProva, tentsTreino] = await Promise.all([
    Promise.all(emBlocos([...idsProva], 50).map((provas) =>
      lerPorIds<TentativaLida>(contaIds, (bloco, de, ate) =>
        db.from("tentativas").select(COLUNAS_TENTATIVA).in("conta_id", bloco).in("simulado_id", provas).order("id").range(de, ate)))),
    lerPorIds<TentativaLida & { simulados: SimuladoLido | null }>(contaIds, (bloco, de, ate) => {
      let q = db.from("tentativas").select(`${COLUNAS_TENTATIVA}, simulados!inner(${COLUNAS_SIMULADO})`)
        .in("conta_id", bloco).eq("simulados.tipo", "treino");
      if (janela) q = q.gte("iniciada_em", janela.de).lt("iniciada_em", janela.ate);
      // Sem tipos gerados, o embed viria tipado como lista; aqui é um só (muitos-para-um).
      return q.order("id").range(de, ate) as unknown as Resposta<TentativaLida & { simulados: SimuladoLido | null }>;
    }),
  ]);
  const tentProva = new Map<string, TentativaLida>();
  for (const t of tentsProva.flat()) tentProva.set(`${t.conta_id}|${t.simulado_id}`, t);

  const treinos = tentsTreino
    .filter((t) => t.simulados && (!anoNumerico || anoSP(t.iniciada_em) === ano))
    .map(({ simulados: s, ...t }) => ({ t, s: s as SimuladoLido }))
    .sort((a, c) => a.t.iniciada_em.localeCompare(c.t.iniciada_em) || a.t.id.localeCompare(c.t.id));

  // Respostas das tentativas entregues (provas do grupo + treinos do ano), com matéria e anulada da questão.
  const entregues = [...tentProva.values(), ...treinos.map((x) => x.t)].filter((t) => t.status === "entregue");
  // A questão vem junto (FK tentativa_respostas.questao_id → questoes).
  type RespostaComQuestao = { tentativa_id: string; correta: boolean | null; questoes: { materia: string | null; anulada: boolean } | null };
  const resps = await lerPorIds<RespostaComQuestao>(entregues.map((t) => t.id), (bloco, de, ate) =>
    db.from("tentativa_respostas").select("tentativa_id, correta, questoes(materia, anulada)").in("tentativa_id", bloco).order("tentativa_id").order("questao_id").range(de, ate) as unknown as Resposta<RespostaComQuestao>);
  const respostas = new Map<string, RespostaLida[]>();
  for (const r of resps) {
    const q = r.questoes;
    if (!q) continue;
    const lista = respostas.get(r.tentativa_id) ?? [];
    lista.push({ materia: q.materia, correta: r.correta, anulada: q.anulada });
    respostas.set(r.tentativa_id, lista);
  }

  // Aulas publicadas dos cursos ligados, na ordem do curso (módulo, depois aula).
  const cursoIds = [...new Set(cts.map((c) => c.curso_id))];
  let aulas: AulaLida[] | null = null;
  const progresso = new Map<string, ProgressoLido>();
  if (cursoIds.length) {
    const [modulos, aulasLidas] = await Promise.all([
      lerPorIds<{ id: string; ordem: number }>(cursoIds, (bloco, de, ate) =>
        db.from("modulos").select("id, ordem").in("curso_id", bloco).order("id").range(de, ate)),
      lerPorIds<AulaLida>(cursoIds, (bloco, de, ate) =>
        db.from("aulas").select("id, curso_id, modulo_id, titulo, ordem").in("curso_id", bloco).eq("publicada", true).order("id").range(de, ate)),
    ]);
    const ordemModulo = new Map(modulos.map((m) => [m.id, m.ordem]));
    aulas = aulasLidas.sort((a, c) =>
      a.curso_id.localeCompare(c.curso_id) || (ordemModulo.get(a.modulo_id) ?? 0) - (ordemModulo.get(c.modulo_id) ?? 0)
      || a.modulo_id.localeCompare(c.modulo_id) || a.ordem - c.ordem);
    if (contaIds.length) {
      const prog = await lerPorIds<ProgressoLido>(contaIds, (bloco, de, ate) =>
        db.from("aula_progresso").select("conta_id, aula_id, maior_posicao_seg, duracao_seg, concluida_em")
          .in("conta_id", bloco).in("curso_id", cursoIds).order("conta_id").order("aula_id").range(de, ate));
      for (const p of prog) progresso.set(`${p.conta_id}|${p.aula_id}`, p);
    }
  }
  return { simulados, tentProva, treinos, respostas, aulas, progresso };
}

// ---------- montagem por pessoa ----------

function linhaSimulado(s: SimuladoLido, t: TentativaLida | undefined, temConta: boolean, agora: Date, abreEm = s.abre_em): LinhaSimuladoAluno {
  const situacao = situacaoNoSimulado(t ?? null, temConta, agora);
  const fez = situacao === "fez" && t;
  return {
    simuladoId: s.id,
    titulo: s.titulo,
    abreEm,
    fechaEm: s.fecha_em,
    situacao,
    nota10: fez && t.porcentagem != null ? Number(t.porcentagem) / 10 : null,
    tempoSeg: fez ? tempoDeProvaSeg(s.tipo, t) : null,
    saidas: t ? t.saidas ?? 0 : null,
    tempoForaSeg: t ? t.tempo_fora_seg ?? 0 : null,
  };
}

function simuladosDaPessoa(e: Extras, contaId: string | null, agora: Date): LinhaSimuladoAluno[] {
  return e.simulados.map((s) => linhaSimulado(s, contaId ? e.tentProva.get(`${contaId}|${s.id}`) : undefined, !!contaId, agora));
}

/** Treinos com tentativa (um treino nunca começado não aparece); a data é a de início. */
function treinosDaPessoa(e: Extras, contaId: string | null, agora: Date): LinhaSimuladoAluno[] {
  if (!contaId) return [];
  return e.treinos.filter((x) => x.t.conta_id === contaId).map(({ t, s }) => linhaSimulado(s, t, true, agora, s.abre_em ?? t.iniciada_em));
}

function respostasDasContas(e: Extras, contaIds: Set<string>): RespostaLida[] {
  const tents = [...e.tentProva.values(), ...e.treinos.map((x) => x.t)].filter((t) => contaIds.has(t.conta_id));
  return tents.flatMap((t) => e.respostas.get(t.id) ?? []);
}

/** % e estado de cada aula pelas mesmas regras da plataforma de estudos (src/lib/aulas/progresso.ts). */
function aulasDaPessoa(e: Extras, contaId: string | null): ResumoAulas | null {
  if (!e.aulas || !contaId) return null;
  return resumoAulas(e.aulas.map((a) => {
    const p = e.progresso.get(`${contaId}|${a.id}`) ?? null;
    return { titulo: a.titulo, pct: porcentagemAula(p), estado: estadoAula(p) };
  }));
}

/**
 * Atividades do bimestre vigente (sem vigente: o bimestre da linha pedida) na linha da pessoa,
 * na ordem da planilha. Sem linha da pessoa naquele bimestre → lista vazia.
 */
function atividadesDaPessoa(b: Base, p: Pessoa, alvo: Linha): { bimestre: string; atividades: AtividadeAluno[] } {
  const turma = b.turmas.find((t) => t.bimestre_vigente) ?? b.turmas.find((t) => t.id === alvo.turmaId) ?? b.turmas[0];
  const linha = turma.id === alvo.turmaId ? alvo : b.linhas.find((l) => l.turmaId === turma.id && p.alunoIds.has(l.alunoId));
  if (!linha) return { bimestre: turma.bimestre, atividades: [] };
  return { bimestre: turma.bimestre, atividades: atividadesDaLinha(b.colunas.filter((c) => c.turma_id === turma.id), b.celulas[linha.alunoId]) };
}

/** As 3 matérias com menor acerto, de preferência com 5+ questões. */
function materiasMaisFracas(materias: AcertoMateria[]): AcertoMateria[] {
  return [...materias.filter((m) => !m.poucas), ...materias.filter((m) => m.poucas)].slice(0, 3);
}

// ---------- API ----------

export async function carregarRelatorioTurma(g: GrupoTurma, agora = new Date()): Promise<RelatorioTurma> {
  const b = await carregarBase(g);
  const ref = turmaDeReferencia(b);
  const pessoas = b.linhas.filter((l) => l.turmaId === ref.id).map((l) => montarPessoa(b, l));
  const contaIds = [...new Set(pessoas.map((p) => p.contaId).filter((c): c is string => !!c))];
  const e = await carregarExtras(b, contaIds, agora);

  const sims = new Map(pessoas.map((p) => [p.alunoId, simuladosDaPessoa(e, p.contaId, agora)]));
  const encerrados = b.turmas.map((t) => t.bimestre_encerrado);
  const iVigente = b.turmas.findIndex((t) => t.bimestre_vigente);
  const ranking = rankingTurma(pessoas.map((p) => {
    const medias = p.bimestres.map((x) => x.media);
    return { alunoId: p.alunoId, nome: p.nome, medias, encerrados, vigente: iVigente >= 0 ? medias[iVigente] : null };
  }));
  const mediaRanking = new Map(ranking.map((a) => [a.alunoId, a.mediaRanking]));

  // Na ordem da planilha; a tabela da página ordena por nome ou por `mediaRanking`.
  const alunos: AlunoDaTurma[] = pessoas.map((p) => ({
    alunoId: p.alunoId,
    nome: p.nome,
    medias: p.bimestres.map((x) => x.media),
    mediaRanking: mediaRanking.get(p.alunoId) ?? null,
    quantoFalta: quantoFalta(p.bimestres, b.media),
    temConta: !!p.contaId,
    simuladosFeitos: (sims.get(p.alunoId) ?? []).filter((s) => s.situacao === "fez").length,
    simuladosTotal: e.simulados.length,
    aulasConcluidas: aulasDaPessoa(e, p.contaId)?.concluidas ?? null,
  }));

  // Média da turma em cada bimestre: igual à tela (todas as células com valor dos alunos daquele bimestre).
  const mediaPorBimestre: MediaBimestreTurma[] = b.turmas.map((t) => {
    const valores = b.linhas.filter((l) => l.turmaId === t.id)
      .flatMap((l) => Object.values(b.celulas[l.alunoId] ?? {}))
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);
    return { bimestre: t.bimestre, turmaId: t.id, media: m10(mediaDeValores(valores)), encerrado: t.bimestre_encerrado, vigente: t.bimestre_vigente };
  });

  const { media: mediaTurma, base: mediaTurmaBase } = mediaDaTurma(mediaPorBimestre);
  const abaixoDaMedia = ranking
    .filter((a): a is typeof a & { mediaRanking: number } => a.mediaRanking != null && a.mediaRanking + 1e-9 < b.media)
    .map((a) => ({ alunoId: a.alunoId, nome: a.nome, media: a.mediaRanking }));

  const simulados: SimuladoDaTurma[] = e.simulados.map((s, i) => {
    const linhas = pessoas.map((p) => ({ nome: p.nome, situacao: (sims.get(p.alunoId) ?? [])[i]?.situacao }));
    return {
      simuladoId: s.id,
      titulo: s.titulo,
      abreEm: s.abre_em,
      fechaEm: s.fecha_em,
      fizeram: linhas.filter((l) => l.situacao === "fez").length,
      total: pessoas.length,
      naoFizeram: linhas.filter((l) => l.situacao === "nao_fez" || l.situacao === "nao_entregou" || l.situacao === "sem_login").map((l) => l.nome),
    };
  });

  const materias = acertoPorMateria(respostasDasContas(e, new Set(contaIds)));
  const semFrase: Omit<RelatorioTurma, "frase"> = {
    turmaNome: g.nome,
    anoLetivo: g.anoLetivo,
    mediaAprovacao: b.media,
    alunos,
    mediaPorBimestre,
    mediaTurma,
    mediaTurmaBase,
    abaixoDaMedia,
    simulados,
    materias,
    materiasFracas: materiasMaisFracas(materias),
    distribuicao: distribuicaoMedias(ranking.map((a) => a.mediaRanking)),
  };
  return { ...semFrase, frase: fraseTurma(semFrase, b.media) };
}

/** `alunoId`: a linha de `alunos` de qualquer bimestre do grupo. */
export async function carregarRelatorioAluno(g: GrupoTurma, alunoId: string, agora = new Date()): Promise<RelatorioAluno> {
  const b = await carregarBase(g);
  const alvo = b.linhas.find((l) => l.alunoId === alunoId);
  if (!alvo) throw new AlunoForaDoGrupo();
  const p = montarPessoa(b, alvo);
  const e = await carregarExtras(b, p.contaId ? [p.contaId] : [], agora);
  const conta = p.contaId ? b.contas.get(p.contaId) ?? null : null;
  const { bimestre: atividadesBimestre, atividades } = atividadesDaPessoa(b, p, alvo);

  const semFrase: Omit<RelatorioAluno, "frase"> = {
    nome: p.nome,
    turmaNome: g.nome,
    anoLetivo: g.anoLetivo,
    bimestres: p.bimestres,
    quantoFalta: quantoFalta(p.bimestres, b.media),
    mediaAprovacao: b.media,
    atividades,
    atividadesBimestre,
    temConta: !!p.contaId,
    materias: p.contaId ? acertoPorMateria(respostasDasContas(e, new Set([p.contaId]))) : [],
    simulados: simuladosDaPessoa(e, p.contaId, agora),
    treinos: treinosDaPessoa(e, p.contaId, agora),
    aulas: aulasDaPessoa(e, p.contaId),
    ultimoAcesso: conta?.ultimo_acesso ?? null,
    historicoParcial: p.parcial,
  };
  return { ...semFrase, frase: fraseAluno(semFrase, b.media) };
}
