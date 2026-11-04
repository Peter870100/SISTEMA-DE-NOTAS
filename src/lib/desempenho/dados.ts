/**
 * Leitura das respostas para o painel "Meu desempenho". A permissão fica com quem chama (a conta vem
 * da sessão do aluno; a escola passa por `exigirTurmaDaEscola` + `podeVerGrupo`).
 * A coluna `resposta` (gabarito) só é lida em `questoesErradas`, no servidor.
 */
import { supabase } from "@/lib/supabase/client";
import { cursosDoAluno } from "@/lib/aulas/acesso";
import { emBlocos } from "@/lib/simulados/regras";
import { questoesParaAluno, type QuestaoAluno } from "@/lib/simulados/servidor";
import type { GrupoTurma } from "@/lib/relatorios/acesso";
import type { EtapaPlano } from "@/lib/plano/tipos";
import type { AlunoConta, Letra } from "@/lib/types";
import { entraNoPainel } from "./acesso";
import { chaveConteudo, primeirasRespostas, respostasIniciais } from "./calculos";
import type { RespostaDesempenho } from "./tipos";

// ---------- leitura paginada (mesmo padrão de relatorios/dados.ts) ----------

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function lerTodas<T>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return todas;
  }
}

/** Lê por ids em blocos de 200 (limite de URL do `.in()`), um bloco por vez. */
async function lerPorIds<T>(ids: string[], montar: (bloco: string[], de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const saida: T[] = [];
  for (const bloco of emBlocos([...new Set(ids)], 200)) saida.push(...(await lerTodas<T>((de, ate) => montar(bloco, de, ate))));
  return saida;
}

// ---------- montagem comum ----------

type TentativaLida = { id: string; simulado_id: string; conta_id: string; entregue_em: string | null };
type SimuladoLido = { id: string; titulo: string; tipo: "professor" | "treino"; correcao: string; fecha_em: string | null; escola_id: string; plano_etapa?: EtapaPlano | null; plano_conteudo?: string | null };

/** Lê respostas, questões e assuntos das tentativas dadas e monta as linhas do painel. */
async function montarRespostas(tentativas: TentativaLida[], simulados: Map<string, SimuladoLido>): Promise<RespostaDesempenho[]> {
  if (tentativas.length === 0) return [];
  const lidas = await lerPorIds<{ tentativa_id: string; questao_id: string; alternativa: string | null; correta: boolean | null }>(
    tentativas.map((t) => t.id),
    (bloco, de, ate) => supabase.from("tentativa_respostas").select("tentativa_id, questao_id, alternativa, correta")
      .in("tentativa_id", bloco).order("tentativa_id").order("questao_id").range(de, ate));
  const questoes = new Map((await lerPorIds<{ id: string; materia: string | null; assunto_id: string | null; topico_id: string | null; anulada: boolean | null }>(
    lidas.map((r) => r.questao_id),
    (bloco, de, ate) => supabase.from("questoes").select("id, materia, assunto_id, topico_id, anulada").in("id", bloco).order("id").range(de, ate))).map((q) => [q.id, q]));
  const assuntos = new Map((await lerPorIds<{ id: string; nome: string }>(
    [...questoes.values()].map((q) => q.assunto_id).filter((a): a is string => !!a),
    (bloco, de, ate) => supabase.from("assuntos").select("id, nome").in("id", bloco).order("id").range(de, ate))).map((a) => [a.id, a.nome]));
  const topicos = new Map((await lerPorIds<{ id: string; nome: string }>(
    [...questoes.values()].map((q) => q.topico_id).filter((t): t is string => !!t),
    (bloco, de, ate) => supabase.from("topicos").select("id, nome").in("id", bloco).order("id").range(de, ate))).map((t) => [t.id, t.nome]));
  const porTentativa = new Map(tentativas.map((t) => [t.id, t]));

  return lidas.flatMap((r): RespostaDesempenho[] => {
    const t = porTentativa.get(r.tentativa_id);
    const q = questoes.get(r.questao_id);
    const s = t ? simulados.get(t.simulado_id) : undefined;
    if (!t || !q || !s || !t.entregue_em) return [];
    return [{
      contaId: t.conta_id, tentativaId: t.id, atividadeId: s.id, atividadeTitulo: s.titulo,
      tipo: s.tipo, entregueEm: new Date(t.entregue_em).toISOString(),
      questaoId: q.id, materia: q.materia, assuntoId: q.assunto_id, assuntoNome: q.assunto_id ? assuntos.get(q.assunto_id) ?? null : null,
      alternativa: (r.alternativa as Letra | null) ?? null, correta: r.correta, anulada: !!q.anulada,
      topicoId: q.topico_id, topicoNome: q.topico_id ? topicos.get(q.topico_id) ?? null : null, planoEtapa: s.plano_etapa ?? null, planoConteudo: s.plano_conteudo ?? null,
    }];
  });
}

async function lerSimulados(ids: string[]): Promise<Map<string, SimuladoLido>> {
  const lidos = await lerPorIds<SimuladoLido>(ids, (bloco, de, ate) =>
    supabase.from("simulados").select("id, titulo, tipo, correcao, fecha_em, escola_id, plano_etapa, plano_conteudo").in("id", bloco).order("id").range(de, ate));
  return new Map(lidos.map((s) => [s.id, s]));
}

// ---------- API ----------

/** Todas as respostas entregues da conta (simulados do professor e treinos, todos os anos e turmas). */
export async function respostasDaConta(contaId: string, escolaId: string, visao: "aluno" | "escola", agora = new Date()): Promise<RespostaDesempenho[]> {
  const tentativas = await lerTodas<TentativaLida>((de, ate) =>
    supabase.from("tentativas").select("id, simulado_id, conta_id, entregue_em")
      .eq("conta_id", contaId).eq("status", "entregue").order("id").range(de, ate));
  const simulados = await lerSimulados(tentativas.map((t) => t.simulado_id));
  const validas = tentativas.filter((t) => {
    const s = simulados.get(t.simulado_id);
    return !!s && s.escola_id === escolaId && entraNoPainel(s, agora, visao);
  });
  return montarRespostas(validas, simulados);
}

/** Respostas dos alunos com conta da turma, só em simulados do professor ligados ao grupo (sem treinos). */
export async function respostasDaTurma(g: GrupoTurma): Promise<RespostaDesempenho[]> {
  const [vinculos, ligados] = await Promise.all([
    lerTodas<{ conta_id: string }>((de, ate) =>
      supabase.from("aluno_turmas").select("conta_id").eq("escola_id", g.escolaId).eq("turma_nome", g.nome).eq("ano_letivo", g.anoLetivo).order("conta_id").range(de, ate)),
    lerTodas<{ simulado_id: string }>((de, ate) =>
      supabase.from("simulado_turmas").select("simulado_id").eq("escola_id", g.escolaId).eq("turma_nome", g.nome).eq("ano_letivo", g.anoLetivo).order("simulado_id").range(de, ate)),
  ]);
  const contaIds = [...new Set(vinculos.map((v) => v.conta_id))];
  if (contaIds.length === 0 || ligados.length === 0) return [];
  const todos = await lerSimulados(ligados.map((l) => l.simulado_id));
  const simulados = new Map([...todos].filter(([, s]) => s.tipo === "professor" && s.escola_id === g.escolaId));
  if (simulados.size === 0) return [];
  const contas = new Set(contaIds);
  const tentativas = (await lerPorIds<TentativaLida>([...simulados.keys()], (bloco, de, ate) =>
    supabase.from("tentativas").select("id, simulado_id, conta_id, entregue_em").in("simulado_id", bloco).eq("status", "entregue").order("id").range(de, ate)))
    .filter((t) => contas.has(t.conta_id));
  return montarRespostas(tentativas, simulados);
}

export type QuestaoErrada = { questao: QuestaoAluno; marcada: Letra | null; certa: Letra | null; resolucao: string | null; atividadeTitulo: string };

/** Questões que o aluno errou ou deixou em branco na primeira resposta, dentro de um conteúdo (chave do painel). */
export async function questoesErradas(rs: RespostaDesempenho[], chave: string): Promise<QuestaoErrada[]> {
  const erradas = primeirasRespostas(respostasIniciais(rs))
    .filter((r) => chaveConteudo(r) === chave && (r.alternativa == null || r.correta !== true))
    .sort((a, b) => (a.entregueEm < b.entregueEm ? -1 : a.entregueEm > b.entregueEm ? 1 : 0));
  const unicas = [...new Map(erradas.map((r) => [r.questaoId, r])).values()];
  if (unicas.length === 0) return [];
  const ids = unicas.map((r) => r.questaoId);
  const [questoes, gabaritos] = await Promise.all([
    questoesParaAluno(ids, 1800),
    lerPorIds<{ id: string; resposta: string | null; resolucao: string | null }>(ids, (bloco, de, ate) =>
      supabase.from("questoes").select("id, resposta, resolucao").in("id", bloco).order("id").range(de, ate)),
  ]);
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const gab = new Map(gabaritos.map((g) => [g.id, g]));
  return unicas.flatMap((r): QuestaoErrada[] => {
    const questao = porId.get(r.questaoId);
    if (!questao) return [];
    const g = gab.get(r.questaoId);
    return [{ questao, marcada: r.alternativa, certa: (g?.resposta as Letra | null) ?? null, resolucao: g?.resolucao ?? null, atividadeTitulo: r.atividadeTitulo }];
  });
}

/** Aulas publicadas dos cursos do aluno (para sugerir revisão); `[]` em caso de erro. */
export async function aulasDoAlunoParaRevisao(contaId: string, escolaId: string): Promise<{ id: string; titulo: string }[]> {
  try {
    // cursosDoAluno só usa id e escola_id da conta.
    const cursos = await cursosDoAluno({ id: contaId, escola_id: escolaId } as AlunoConta);
    if (cursos.length === 0) return [];
    const { data, error } = await supabase.from("aulas").select("id, titulo")
      .in("curso_id", cursos.map((c) => c.id)).eq("publicada", true).order("ordem");
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error("aulasDoAlunoParaRevisao:", e);
    return [];
  }
}
