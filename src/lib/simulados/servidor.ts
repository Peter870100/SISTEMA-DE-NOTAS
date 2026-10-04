import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import type { ImagemTela } from "@/components/questoes/ImagemQuestao";
import type { AlunoConta, Alternativa, Area, Letra, Professor, Simulado } from "@/lib/types";
import { acumularTempo, corrigir, tempoEsgotado, TOLERANCIA_SEG, type Gabarito } from "./regras";

export type QuestaoAluno = { id: string; enunciado: string; comando: string; alternativas: Alternativa[]; imagens: ImagemTela[] };

/** Questões para mostrar ao aluno — a coluna `resposta` nunca é lida aqui. */
export async function questoesParaAluno(ids: string[], validadeSeg: number): Promise<QuestaoAluno[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("questoes").select("id, enunciado, comando, alternativas").in("id", ids);
  const imagens = await imagensParaTela(ids, validadeSeg);
  const porId = new Map((data ?? []).map((q) => [q.id, q]));
  return ids.flatMap((id) => {
    const q = porId.get(id);
    return q ? [{ id, enunciado: q.enunciado, comando: q.comando, alternativas: q.alternativas, imagens: imagens.get(id) ?? [] }] : [];
  });
}

export function podeEditarSimulado(professor: Professor, s: Simulado): boolean {
  return s.tipo === "professor" && s.escola_id === professor.escola_id && (s.professor_id === professor.id || ehAdmin(professor.role));
}

export async function exigirSimuladoEditavel(simuladoId: string): Promise<{ professor: Professor; simulado: Simulado }> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: simulado } = await supabase.from("simulados").select("*").eq("id", simuladoId).maybeSingle();
  if (!simulado || !podeEditarSimulado(professor, simulado)) throw new Error("Simulado não encontrado.");
  return { professor, simulado };
}

export async function simuladoVisivelParaAluno(aluno: AlunoConta, s: Simulado): Promise<boolean> {
  if (s.escola_id !== aluno.escola_id) return false;
  if (s.tipo === "treino") return s.conta_id === aluno.id;
  if (s.status !== "publicado") return false;
  const [turmas, { data: alvo }] = await Promise.all([
    turmasDoAluno(aluno.id),
    supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", s.id),
  ]);
  const minhas = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  return (alvo ?? []).some((t) => minhas.has(`${t.turma_nome}|${t.ano_letivo}`));
}

export function filtroVisivel(escolaId: string): string {
  return `escopo.eq.geral,escola_id.eq.${escolaId}`;
}

export type FiltrosSorteio = { area?: Area; materia?: string; assunto_id?: string; banca?: string; anoDe?: number; anoAte?: number };

export async function candidatosSorteio(escolaId: string, f: FiltrosSorteio, excluir: string[]): Promise<string[]> {
  let c = supabase.from("questoes").select("id").eq("status", "publicada").or(filtroVisivel(escolaId));
  if (f.area) c = c.eq("area", f.area);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.assunto_id) c = c.eq("assunto_id", f.assunto_id);
  if (f.banca) c = c.eq("banca", f.banca);
  if (f.anoDe) c = c.gte("ano", f.anoDe);
  if (f.anoAte) c = c.lte("ano", f.anoAte);
  const { data } = await c.limit(3000);
  const fora = new Set(excluir);
  return (data ?? []).map((q) => q.id).filter((id) => !fora.has(id));
}

/** Entrega e corrige. O update condicional garante uma única correção, mesmo com dois chamadores. */
export async function entregarTentativa(tentativaId: string): Promise<void> {
  const agora = new Date().toISOString();
  const { data: tomou } = await supabase.from("tentativas").update({ status: "entregue", entregue_em: agora }).eq("id", tentativaId).eq("status", "em_andamento").select("*");
  const t = tomou?.[0];
  if (!t) return;
  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    supabase.from("questoes").select("id, resposta, anulada, area").in("id", t.ordem),
    supabase.from("tentativa_respostas").select("questao_id, alternativa").eq("tentativa_id", t.id),
  ]);
  const gabarito: Gabarito = new Map((questoes ?? []).map((q) => [q.id, { resposta: q.resposta as Letra | null, anulada: q.anulada, area: q.area as Area }]));
  const marcadas = new Map((respostas ?? []).map((r) => [r.questao_id, r.alternativa as Letra | null]));
  const r = corrigir(marcadas, gabarito);
  const linhas = [...r.corretas].map(([questao_id, correta]) => ({ tentativa_id: t.id, questao_id, alternativa: marcadas.get(questao_id) ?? null, correta }));
  if (linhas.length) {
    const { error } = await supabase.from("tentativa_respostas").upsert(linhas, { onConflict: "tentativa_id,questao_id" });
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("tentativas").update({ acertos: r.acertos, total: r.total, porcentagem: r.porcentagem, por_area: r.porArea }).eq("id", t.id);
  if (error) throw new Error(error.message);
}

/** Entrega preguiçosa: tentativas cujo tempo acabou e o aluno não entregou. */
export async function fecharVencidas(simuladoId: string): Promise<void> {
  const { data: s } = await supabase.from("simulados").select("tipo, duracao_min").eq("id", simuladoId).maybeSingle();
  if (!s) return;
  const { data: abertas } = await supabase.from("tentativas").select("id, prazo_em, tempo_usado_seg, ultimo_pulso_em").eq("simulado_id", simuladoId).eq("status", "em_andamento");
  const agora = new Date();
  for (const t of abertas ?? []) {
    const vencida = s.tipo === "professor"
      ? !!t.prazo_em && agora.getTime() > Date.parse(t.prazo_em) + TOLERANCIA_SEG * 1000
      : tempoEsgotado(acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora), s.duracao_min);
    if (vencida) await entregarTentativa(t.id);
  }
}
