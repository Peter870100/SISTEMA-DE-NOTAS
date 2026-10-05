import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import type { ImagemTela } from "@/components/questoes/ImagemQuestao";
import type { AlunoConta, Alternativa, Area, Letra, Professor, Simulado } from "@/lib/types";
import { acumularTempo, correcaoLiberada, corrigir, emBlocos, tempoEsgotado, TOLERANCIA_SEG, type Gabarito } from "./regras";

export type QuestaoAluno = { id: string; enunciado: string; comando: string; alternativas: Alternativa[]; imagens: ImagemTela[] };

/** Questões para mostrar ao aluno — a coluna `resposta` nunca é lida aqui. */
export async function questoesParaAluno(ids: string[], validadeSeg: number): Promise<QuestaoAluno[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("questoes").select("id, enunciado, comando, alternativas").in("id", ids);
  if (error) throw new Error(error.message);
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
  // O PostgREST limita cada resposta a 1000 linhas: lê por páginas ordenadas até acabar.
  const ids: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await c.order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    ids.push(...(data ?? []).map((q) => q.id));
    if ((data ?? []).length < 1000) break;
  }
  const fora = new Set(excluir);
  return ids.filter((id) => !fora.has(id));
}

/** Questões de simulados do professor já publicados para as turmas do aluno e cuja correção ainda não saiu. */
export async function questoesDeProvasEmSigilo(aluno: AlunoConta): Promise<string[]> {
  const turmas = await turmasDoAluno(aluno.id);
  const minhas = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const nomes = [...new Set(turmas.map((t) => t.turma_nome))];
  if (nomes.length === 0) return [];
  const { data: alvos, error: eA } = await supabase.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").eq("escola_id", aluno.escola_id).in("turma_nome", nomes);
  if (eA) throw new Error(eA.message);
  const simuladoIds = [...new Set((alvos ?? []).filter((a) => minhas.has(`${a.turma_nome}|${a.ano_letivo}`)).map((a) => a.simulado_id))];
  const agora = new Date();
  const sigilosos: string[] = [];
  for (const bloco of emBlocos(simuladoIds, 100)) {
    const { data, error } = await supabase.from("simulados").select("id, tipo, correcao, fecha_em").in("id", bloco).eq("escola_id", aluno.escola_id).eq("tipo", "professor").eq("status", "publicado");
    if (error) throw new Error(error.message);
    sigilosos.push(...(data ?? []).filter((s) => !correcaoLiberada(s, agora)).map((s) => s.id));
  }
  const questoes = new Set<string>();
  for (const bloco of emBlocos(sigilosos, 50)) {
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from("simulado_questoes").select("simulado_id, questao_id").in("simulado_id", bloco).order("simulado_id").order("questao_id").range(de, de + 999);
      if (error) throw new Error(error.message);
      for (const q of data ?? []) questoes.add(q.questao_id);
      if ((data ?? []).length < 1000) break;
    }
  }
  return [...questoes];
}

/** Corrige e grava o resultado. Idempotente: pode rodar mais de uma vez para a mesma tentativa. */
export async function corrigirTentativa(tentativaId: string): Promise<void> {
  const { data: t, error: eT } = await supabase.from("tentativas").select("id, ordem").eq("id", tentativaId).maybeSingle();
  if (eT) throw new Error(eT.message);
  if (!t) return;
  const [{ data: questoes, error: eQ }, { data: respostas, error: eR }] = await Promise.all([
    supabase.from("questoes").select("id, resposta, anulada, area").in("id", t.ordem),
    supabase.from("tentativa_respostas").select("questao_id, alternativa").eq("tentativa_id", t.id),
  ]);
  if (eQ) throw new Error(eQ.message);
  if (eR) throw new Error(eR.message);
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

/** Entrega e corrige. O update condicional garante uma única entrega, mesmo com dois chamadores. */
export async function entregarTentativa(tentativaId: string): Promise<void> {
  const agora = new Date().toISOString();
  const { data: tomou, error } = await supabase.from("tentativas").update({ status: "entregue", entregue_em: agora }).eq("id", tentativaId).eq("status", "em_andamento").select("id");
  if (error) throw new Error(error.message);
  if (!tomou?.[0]) return;
  await corrigirTentativa(tentativaId);
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
    if (!vencida) continue;
    try { await entregarTentativa(t.id); } catch (e) { console.error("fecharVencidas: falha ao entregar", t.id, e); }
  }
  const { data: semNota } = await supabase.from("tentativas").select("id").eq("simulado_id", simuladoId).eq("status", "entregue").is("total", null);
  for (const t of semNota ?? []) {
    try { await corrigirTentativa(t.id); } catch (e) { console.error("fecharVencidas: falha ao corrigir", t.id, e); }
  }
}
