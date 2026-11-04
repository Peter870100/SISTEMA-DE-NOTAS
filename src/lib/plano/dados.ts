/**
 * Leitura do servidor para o plano de estudo: painel, plano e extras por conteúdo (materiais, resoluções,
 * questões disponíveis, pré-requisitos, habilidades). A permissão fica com quem chama (conta da sessão ou
 * `exigirTurmaDaEscola`). Nada aqui grava no banco.
 */
import { supabase } from "@/lib/supabase/client";
import { cursosDoAluno } from "@/lib/aulas/acesso";
import { chaveConteudo, montarPainel, primeirasRespostas, respostasIniciais } from "@/lib/desempenho/calculos";
import { lerPorIds, lerTodas, respostasDaConta } from "@/lib/desempenho/dados";
import { regrasDoPainel } from "@/lib/desempenho/regras";
import type { PainelDesempenho, RespostaDesempenho } from "@/lib/desempenho/tipos";
import { ordenarHabilidades } from "@/lib/questoes/classificacao";
import { aulasDoTema } from "@/lib/simulados/revisao";
import { filtroVisivel, questoesDeProvasEmSigilo } from "@/lib/simulados/servidor";
import type { AlunoConta, Area, MaterialRevisao } from "@/lib/types";
import { chaveValida, materiaisDoConteudo, type ExtrasConteudo, type MaterialTela } from "./extras";
import { montarPlano } from "./plano";
import { regrasDaEscola } from "./regras-servidor";
import { contarDisponiveis, facilidadeDe, type Candidata } from "./selecao";
import type { EtapaPlano, Plano, RegrasAprendizagem, TreinoDoPlano } from "./tipos";

export type DadosPlano = {
  painel: PainelDesempenho; respostas: RespostaDesempenho[]; plano: Plano; extras: Record<string, ExtrasConteudo>;
  regras: RegrasAprendizagem; habilidadesAlvo: Record<string, string[]>;
};

const maior = (a: string | undefined, b: string | null | undefined) => (b && (!a || b > a) ? b : a);
// As leituras abaixo só usam id e escola_id da conta.
const comoAluno = (id: string, escolaId: string) => ({ id, escola_id: escolaId }) as AlunoConta;

async function lerTreinos(contaId: string): Promise<TreinoDoPlano[]> {
  const sims = await lerTodas<{ id: string; plano_etapa?: EtapaPlano | null; plano_conteudo?: string | null; plano_rodada?: number | null; created_at: string }>((de, ate) =>
    supabase.from("simulados").select("id, plano_etapa, plano_conteudo, plano_rodada, created_at")
      .eq("conta_id", contaId).not("plano_etapa", "is", null).order("id").range(de, ate));
  if (sims.length === 0) return [];
  const tents = await lerPorIds<{ id: string; simulado_id: string; entregue_em: string | null; acertos: number | null; total: number | null; status: string }>(sims.map((s) => s.id), (bloco, de, ate) =>
    supabase.from("tentativas").select("id, simulado_id, entregue_em, acertos, total, status").eq("conta_id", contaId).in("simulado_id", bloco).order("id").range(de, ate));
  const entregues = new Map(tents.filter((t) => t.status === "entregue").map((t) => [t.simulado_id, t]));
  return sims.flatMap((s): TreinoDoPlano[] => {
    if (!s.plano_etapa || !s.plano_conteudo) return [];
    const t = entregues.get(s.id);
    return [{ simuladoId: s.id, conteudo: s.plano_conteudo, etapa: s.plano_etapa, rodada: s.plano_rodada ?? 1, criadoEm: s.created_at,
      entregueEm: t?.entregue_em ?? null, acertos: t?.acertos ?? null, total: t?.total ?? null }];
  });
}

/** Questão → maior `iniciada_em` entre todas as tentativas da conta (para não repetir questão vista há pouco). */
export async function vistasDaConta(contaId: string): Promise<Record<string, string>> {
  const tents = await lerTodas<{ ordem: string[] | null; iniciada_em: string }>((de, ate) =>
    supabase.from("tentativas").select("ordem, iniciada_em").eq("conta_id", contaId).order("id").range(de, ate));
  const vistas: Record<string, string> = {};
  for (const t of tents) for (const q of t.ordem ?? []) if (!vistas[q] || t.iniciada_em > vistas[q]) vistas[q] = t.iniciada_em;
  return vistas;
}

type Alvo = { chave: string; v: NonNullable<ReturnType<typeof chaveValida>> };

/** Candidatas (publicadas, não anuladas, visíveis à escola, fora de provas em sigilo) por chave, em leitura por bloco. */
async function lerCandidatas(aluno: AlunoConta, chaves: string[], vistas: Record<string, string>, comHabilidades: boolean): Promise<Map<string, Candidata[]>> {
  const alvos = chaves.map((c) => ({ chave: c, v: chaveValida(c) })).filter((x): x is Alvo => !!x.v);
  const saida = new Map<string, Candidata[]>(chaves.map((c) => [c, []]));
  if (alvos.length === 0) return saida;
  const sigilo = new Set(await questoesDeProvasEmSigilo(aluno));
  type Linha = { id: string; topico_id: string | null; assunto_id: string | null; materia: string };
  const ler = (coluna: "assunto_id" | "materia", valores: string[]) => lerPorIds<Linha>(valores, (bloco, de, ate) =>
    supabase.from("questoes").select("id, topico_id, assunto_id, materia").eq("status", "publicada").eq("anulada", false)
      .or(filtroVisivel(aluno.escola_id)).in(coluna, bloco).order("id").range(de, ate));
  const porAssunto = alvos.flatMap((x) => ("assuntoId" in x.v ? [x.v.assuntoId] : []));
  const porMateria = alvos.flatMap((x) => ("materia" in x.v ? [x.v.materia] : []));
  const [qa, qm] = await Promise.all([ler("assunto_id", porAssunto), ler("materia", porMateria)]);
  const todas = new Map([...qa, ...qm].filter((q) => !sigilo.has(q.id)).map((q) => [q.id, q]));
  const habs = new Map<string, string[]>();
  if (comHabilidades && todas.size > 0) {
    const linhas = await lerPorIds<{ questao_id: string; habilidade_id: string }>([...todas.keys()], (bloco, de, ate) =>
      supabase.from("questao_habilidades").select("questao_id, habilidade_id").in("questao_id", bloco).order("questao_id").order("habilidade_id").range(de, ate));
    for (const l of linhas) habs.set(l.questao_id, [...(habs.get(l.questao_id) ?? []), l.habilidade_id]);
  }
  for (const q of todas.values()) {
    const c: Candidata = { id: q.id, topicoId: q.topico_id, habilidadeIds: habs.get(q.id) ?? [], ultimaVez: vistas[q.id] ?? null };
    for (const { chave, v } of alvos) {
      if (("assuntoId" in v && q.assunto_id === v.assuntoId) || ("materia" in v && q.materia === v.materia)) saida.get(chave)!.push(c);
    }
  }
  return saida;
}

export async function candidatasDoConteudo(aluno: AlunoConta, chave: string, vistas: Record<string, string>): Promise<Candidata[]> {
  return (await lerCandidatas(aluno, [chave], vistas, true)).get(chave) ?? [];
}

/** Facilidade (0–100) por questão: taxa de acerto geral (mín. 5 respostas) ou a dificuldade com que foi gerada. */
export async function facilidadeDasQuestoes(ids: string[]): Promise<Record<string, number | null>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};
  const [respostas, questoes] = await Promise.all([
    lerPorIds<{ tentativa_id: string; questao_id: string; correta: boolean | null }>(unicos, (bloco, de, ate) =>
      supabase.from("tentativa_respostas").select("tentativa_id, questao_id, correta").in("questao_id", bloco).not("correta", "is", null).order("tentativa_id").order("questao_id").range(de, ate)),
    lerPorIds<{ id: string; geracao_id: string | null }>(unicos, (bloco, de, ate) =>
      supabase.from("questoes").select("id, geracao_id").in("id", bloco).order("id").range(de, ate)),
  ]);
  const geracoes = new Map((await lerPorIds<{ id: string; dificuldade: "facil" | "media" | "dificil" }>(
    questoes.map((q) => q.geracao_id).filter((g): g is string => !!g),
    (bloco, de, ate) => supabase.from("geracoes_ia").select("id, dificuldade").in("id", bloco).order("id").range(de, ate))).map((g) => [g.id, g.dificuldade]));
  const contagem = new Map<string, { acertos: number; total: number }>();
  for (const r of respostas) {
    const c = contagem.get(r.questao_id) ?? { acertos: 0, total: 0 };
    c.total += 1;
    if (r.correta) c.acertos += 1;
    contagem.set(r.questao_id, c);
  }
  const geracaoDe = new Map(questoes.map((q) => [q.id, q.geracao_id]));
  return Object.fromEntries(unicos.map((id) => [id, facilidadeDe(contagem.get(id) ?? null, geracoes.get(geracaoDe.get(id) ?? "") ?? null)]));
}

export async function carregarPlano(conta: { id: string; escolaId: string }, visao: "aluno" | "escola", agora = new Date()): Promise<DadosPlano> {
  const [regras, respostas] = await Promise.all([regrasDaEscola(conta.escolaId), respostasDaConta(conta.id, conta.escolaId, visao, agora)]);
  const painel = montarPainel(respostas, regrasDoPainel(regras));
  const conteudos = painel.conteudos;
  const chaves = conteudos.map((c) => c.chave);

  const [treinos, revisoes, planoRow] = await Promise.all([
    lerTreinos(conta.id),
    lerTodas<{ conteudo: string; revisado_em: string }>((de, ate) => supabase.from("plano_revisoes").select("conteudo, revisado_em").eq("conta_id", conta.id).order("conteudo").range(de, ate)),
    supabase.from("planos_estudo").select("minutos_semana").eq("conta_id", conta.id).maybeSingle(),
  ]);
  if (planoRow.error) throw new Error(planoRow.error.message);
  const minutosSemana = planoRow.data?.minutos_semana ?? null;

  // ---- materiais ----
  const assuntoIds = conteudos.flatMap((c) => (c.assuntoId ? [c.assuntoId] : []));
  const focoIds = conteudos.flatMap((c) => (c.foco ? [c.foco.topicoId] : []));
  const [porAssunto, porTopico] = await Promise.all([
    lerPorIds<MaterialRevisao>(assuntoIds, (b, de, ate) => supabase.from("materiais_revisao").select("*").in("assunto_id", b).order("created_at").order("id").range(de, ate)),
    lerPorIds<MaterialRevisao>(focoIds, (b, de, ate) => supabase.from("materiais_revisao").select("*").in("topico_id", b).order("created_at").order("id").range(de, ate)),
  ]);
  const linhas = [...new Map([...porAssunto, ...porTopico].map((l) => [l.id, l])).values()];

  const acessiveis: { id: string; titulo: string }[] = [];
  if (visao === "aluno") {
    const cursos = await cursosDoAluno(comoAluno(conta.id, conta.escolaId));
    acessiveis.push(...(await lerPorIds<{ id: string; titulo: string }>(cursos.map((c) => c.id), (b, de, ate) =>
      supabase.from("aulas").select("id, titulo").in("curso_id", b).eq("publicada", true).order("id").range(de, ate))));
  }
  const ehAcessivel = new Set(acessiveis.map((a) => a.id));
  const temaDe = new Map(conteudos.map((c) => [c.chave, visao === "aluno" && c.assuntoId ? aulasDoTema(c.nome, acessiveis) : []]));
  const citadas = [...new Set([...linhas.flatMap((l) => (l.aula_id ? [l.aula_id] : [])), ...[...temaDe.values()].flat().map((a) => a.id)])];
  const titulos = new Map(acessiveis.map((a) => [a.id, a.titulo]));
  const faltam = citadas.filter((id) => !titulos.has(id));
  for (const a of await lerPorIds<{ id: string; titulo: string }>(faltam, (b, de, ate) => supabase.from("aulas").select("id, titulo").in("id", b).order("id").range(de, ate))) titulos.set(a.id, a.titulo);
  const aulas = Object.fromEntries([...titulos].map(([id, titulo]) => [id, { titulo, acessivel: ehAcessivel.has(id) }]));

  const [duracoes, concluidas] = await Promise.all([
    lerPorIds<{ aula_id: string; conta_id: string; duracao_seg: number | null }>(citadas, (b, de, ate) =>
      supabase.from("aula_progresso").select("aula_id, conta_id, duracao_seg").in("aula_id", b).not("duracao_seg", "is", null).order("aula_id").order("conta_id").range(de, ate)),
    lerPorIds<{ aula_id: string; concluida_em: string | null }>(citadas, (b, de, ate) =>
      supabase.from("aula_progresso").select("aula_id, concluida_em").eq("conta_id", conta.id).in("aula_id", b).not("concluida_em", "is", null).order("aula_id").range(de, ate)),
  ]);
  const duracoesSeg: Record<string, number> = {};
  for (const d of duracoes) if (d.duracao_seg && d.duracao_seg > (duracoesSeg[d.aula_id] ?? 0)) duracoesSeg[d.aula_id] = d.duracao_seg;
  const concluidaEm = new Map(concluidas.map((c) => [c.aula_id, c.concluida_em]));

  const materiaisDe: Record<string, MaterialTela[]> = {};
  const revisadoEm: Record<string, string> = {};
  const minutosRevisar: Record<string, number> = {};
  for (const r of revisoes) revisadoEm[r.conteudo] = r.revisado_em;
  for (const c of conteudos) {
    const ms = materiaisDoConteudo({ linhas, topicoFocoId: c.foco?.topicoId ?? null, assuntoId: c.assuntoId, escolaId: conta.escolaId, aulas,
      aulasDoTema: temaDe.get(c.chave) ?? [], duracoesSeg, visao, minutosMaterial: regras.minutosMaterial });
    materiaisDe[c.chave] = ms;
    if (ms.length > 0) minutosRevisar[c.chave] = ms[0].minutos;
    let ultimo: string | undefined = revisadoEm[c.chave];
    for (const m of ms) if (m.tipo === "aula") ultimo = maior(ultimo, concluidaEm.get(m.id));
    if (ultimo) revisadoEm[c.chave] = ultimo;
  }

  // ---- questões erradas: resoluções e habilidades ----
  const erradas = primeirasRespostas(respostasIniciais(respostas)).filter((r) => r.alternativa == null || r.correta !== true);
  const erradasDe = new Map<string, RespostaDesempenho[]>();
  for (const r of erradas) erradasDe.set(chaveConteudo(r), [...(erradasDe.get(chaveConteudo(r)) ?? []), r]);
  const idsErradas = [...new Set(erradas.map((r) => r.questaoId))];
  const [comResolucao, habsQ] = await Promise.all([
    lerPorIds<{ id: string; resolucao: string | null }>(idsErradas, (b, de, ate) => supabase.from("questoes").select("id, resolucao").in("id", b).order("id").range(de, ate)),
    lerPorIds<{ questao_id: string; habilidade_id: string }>(idsErradas, (b, de, ate) =>
      supabase.from("questao_habilidades").select("questao_id, habilidade_id").in("questao_id", b).order("questao_id").order("habilidade_id").range(de, ate)),
  ]);
  const temResolucao = new Set(comResolucao.filter((q) => q.resolucao).map((q) => q.id));
  const habsDaQuestao = new Map<string, string[]>();
  for (const h of habsQ) habsDaQuestao.set(h.questao_id, [...(habsDaQuestao.get(h.questao_id) ?? []), h.habilidade_id]);
  const habPorId = new Map((await lerPorIds<{ id: string; area: Area; codigo: string | null; descricao: string }>(habsQ.map((h) => h.habilidade_id), (b, de, ate) =>
    supabase.from("habilidades").select("id, area, codigo, descricao").in("id", b).order("id").range(de, ate))).map((h) => [h.id, h]));

  // ---- pré-requisitos ----
  const topicosDe = new Map<string, string[]>();
  for (const c of conteudos) {
    topicosDe.set(c.chave, c.foco ? [c.foco.topicoId] : [...new Set((erradasDe.get(c.chave) ?? []).flatMap((r) => (r.topicoId ? [r.topicoId] : [])))]);
  }
  const preLinhas = await lerPorIds<{ topico_id: string; prerequisito_id: string }>([...new Set([...topicosDe.values()].flat())], (b, de, ate) =>
    supabase.from("topico_prerequisitos").select("topico_id, prerequisito_id").in("topico_id", b).order("topico_id").order("prerequisito_id").range(de, ate));
  const topicosPre = new Map((await lerPorIds<{ id: string; nome: string; assunto_id: string }>(preLinhas.map((p) => p.prerequisito_id), (b, de, ate) =>
    supabase.from("topicos").select("id, nome, assunto_id").in("id", b).order("id").range(de, ate))).map((t) => [t.id, t]));
  const nomesAssunto = new Map((await lerPorIds<{ id: string; nome: string }>([...topicosPre.values()].map((t) => t.assunto_id), (b, de, ate) =>
    supabase.from("assuntos").select("id, nome").in("id", b).order("id").range(de, ate))).map((a) => [a.id, a.nome]));
  const eChave = new Set(chaves);

  // ---- disponíveis (só aluno) ----
  let disponiveisDe = new Map<string, number>();
  if (visao === "aluno" && chaves.length > 0) {
    const cands = await lerCandidatas(comoAluno(conta.id, conta.escolaId), chaves, await vistasDaConta(conta.id), false);
    disponiveisDe = new Map([...cands].map(([k, v]) => [k, contarDisponiveis(v, agora, regras.diasSemRepetir)]));
  }

  const extras: Record<string, ExtrasConteudo> = {};
  const habilidadesAlvo: Record<string, string[]> = {};
  const prerequisitos: Record<string, string[]> = {};
  for (const c of conteudos) {
    const qs = [...new Set((erradasDe.get(c.chave) ?? []).map((r) => r.questaoId))];
    const hs = [...new Set(qs.flatMap((q) => habsDaQuestao.get(q) ?? []))];
    habilidadesAlvo[c.chave] = hs;
    const pres = (topicosDe.get(c.chave) ?? []).flatMap((t) => preLinhas.filter((p) => p.topico_id === t).flatMap((p) => topicosPre.get(p.prerequisito_id) ?? []));
    const unicos = [...new Map(pres.map((t) => [t.id, t])).values()];
    prerequisitos[c.chave] = [...new Set(unicos.map((t) => t.assunto_id).filter((a) => a !== c.chave && eChave.has(a)))];
    extras[c.chave] = {
      materiais: materiaisDe[c.chave] ?? [],
      resolucoes: qs.filter((q) => temResolucao.has(q)).length,
      disponiveis: visao === "aluno" ? disponiveisDe.get(c.chave) ?? 0 : null,
      prerequisitos: unicos.map((t) => ({ nome: t.nome, assunto: nomesAssunto.get(t.assunto_id) ?? "" })),
      habilidades: ordenarHabilidades(hs.flatMap((h) => habPorId.get(h) ?? [])).slice(0, 3).map((h) => ({ codigo: h.codigo, descricao: h.descricao })),
    };
  }

  const plano = montarPlano({ conteudos, prioridades: painel.prioridades, treinos, revisadoEm, minutosRevisar, prerequisitos, minutosSemana, regras, agora });
  return { painel, respostas, plano, extras, regras, habilidadesAlvo };
}
