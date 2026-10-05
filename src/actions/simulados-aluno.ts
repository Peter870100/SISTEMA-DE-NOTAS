"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { AREAS } from "@/lib/questoes/materias";
import { candidatosSorteio, entregarTentativa, fecharVencidas, questoesDeProvasEmSigilo, questoesParaAluno, simuladoVisivelParaAluno, type FiltrosSorteio, type QuestaoAluno } from "@/lib/simulados/servidor";
import { aceitaResposta, acumularTempo, correcaoLiberada, MAX_TREINO, ordemEmbaralhada, prazoFinal, situacaoSimulado, sortear, tempoEsgotado } from "@/lib/simulados/regras";
import type { AlunoConta, Letra, PorArea, Simulado, Tentativa, TipoSimulado } from "@/lib/types";

async function exigirAluno(): Promise<AlunoConta> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  return aluno;
}

async function simuladoDoAluno(aluno: AlunoConta, simuladoId: string): Promise<Simulado> {
  const { data: s } = await supabase.from("simulados").select("*").eq("id", simuladoId).maybeSingle();
  if (!s || !(await simuladoVisivelParaAluno(aluno, s))) throw new Error("Simulado não encontrado.");
  return s;
}

async function tentativaDoAluno(aluno: AlunoConta, tentativaId: string): Promise<{ t: Tentativa; s: Simulado }> {
  const { data: t } = await supabase.from("tentativas").select("*").eq("id", tentativaId).eq("conta_id", aluno.id).maybeSingle();
  if (!t) throw new Error("Tentativa não encontrada.");
  const { data: s } = await supabase.from("simulados").select("*").eq("id", t.simulado_id).single();
  return { t, s: s! };
}

export async function criarTreino(f: FiltrosSorteio & { quantidade: number; duracaoMin: number | null; titulo?: string }) {
  const aluno = await exigirAluno();
  const pedidas = Math.round(f.quantidade);
  if (!Number.isFinite(pedidas) || pedidas < 1 || pedidas > MAX_TREINO) throw new Error(`Escolha de 1 a ${MAX_TREINO} questões.`);
  const duracao = f.duracaoMin == null ? null : Math.round(f.duracaoMin);
  if (duracao !== null && (duracao < 1 || duracao > 600)) throw new Error("Tempo de 1 a 600 minutos, ou sem tempo.");
  if (f.area !== undefined && f.area !== null && !Object.prototype.hasOwnProperty.call(AREAS, f.area)) throw new Error("Área inválida.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const filtros: FiltrosSorteio = { area: f.area || undefined, materia: f.materia, assunto_id: f.assunto_id, banca: f.banca, anoDe: num(f.anoDe), anoAte: num(f.anoAte) };
  const ids = sortear(await candidatosSorteio(aluno.escola_id, filtros, await questoesDeProvasEmSigilo(aluno)), pedidas);
  if (ids.length === 0) throw new Error("Não há questões publicadas com esses filtros.");
  const { data: s, error } = await supabase.from("simulados")
    .insert({ escola_id: aluno.escola_id, tipo: "treino", conta_id: aluno.id, titulo: (f.titulo?.trim() || `Treino de ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`).slice(0, 120), duracao_min: duracao, status: "publicado", correcao: "na_hora", embaralhar: false })
    .select("id").single();
  if (error || !s) throw new Error(error?.message ?? "Falha ao criar treino.");
  const { error: e2 } = await supabase.from("simulado_questoes").insert(ids.map((questao_id, ordem) => ({ simulado_id: s.id, questao_id, ordem })));
  if (e2) throw new Error(e2.message);
  return { simuladoId: s.id, sorteadas: ids.length, pedidas };
}

export async function iniciarTentativa(simuladoId: string): Promise<string> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  const { data: existente } = await supabase.from("tentativas").select("id").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (existente) return existente.id;
  if (s.tipo === "professor" && situacaoSimulado(s, new Date()) !== "aberto") throw new Error("Este simulado não está aberto agora.");
  const { data: qs } = await supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", s.id).order("ordem");
  const ids = (qs ?? []).map((q) => q.questao_id);
  if (ids.length === 0) throw new Error("Simulado sem questões.");
  const id = randomUUID();
  const agora = new Date();
  const { error } = await supabase.from("tentativas").insert({
    id, simulado_id: s.id, conta_id: aluno.id,
    ordem: s.tipo === "professor" && s.embaralhar ? ordemEmbaralhada(ids, id) : ids,
    iniciada_em: agora.toISOString(),
    prazo_em: s.tipo === "professor" ? prazoFinal(agora, s.duracao_min, s.fecha_em ? new Date(s.fecha_em) : null)?.toISOString() ?? null : null,
    ultimo_pulso_em: s.tipo === "treino" && s.duracao_min ? agora.toISOString() : null,
  });
  if (error) {
    const { data: outra } = await supabase.from("tentativas").select("id").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
    if (outra) return outra.id; // dois cliques: a outra chamada criou
    throw new Error(error.message);
  }
  return id;
}

export type ProvaAluno = {
  simulado: { id: string; titulo: string; tipo: TipoSimulado; duracaoMin: number | null };
  tentativaId: string;
  status: "em_andamento" | "entregue";
  questoes: QuestaoAluno[];
  respostas: Record<string, Letra | null>;
  prazoEm: string | null;
  restanteSeg: number | null;
  agoraServidor: string;
};

export async function obterProva(simuladoId: string): Promise<ProvaAluno | null> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  await fecharVencidas(s.id);
  const { data: t } = await supabase.from("tentativas").select("*").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (!t) return null;
  const agora = new Date();
  let restanteSeg: number | null = null;
  if (s.tipo === "professor" && t.prazo_em) restanteSeg = Math.max(0, Math.floor((Date.parse(t.prazo_em) - agora.getTime()) / 1000));
  if (s.tipo === "treino" && s.duracao_min) restanteSeg = Math.max(0, s.duracao_min * 60 - t.tempo_usado_seg);
  const validade = Math.min(6 * 3600, Math.max(1800, (restanteSeg ?? 3 * 3600) + 1800));
  const [questoes, { data: resp }] = await Promise.all([
    t.status === "em_andamento" ? questoesParaAluno(t.ordem, validade) : Promise.resolve([]),
    supabase.from("tentativa_respostas").select("questao_id, alternativa").eq("tentativa_id", t.id),
  ]);
  return {
    simulado: { id: s.id, titulo: s.titulo, tipo: s.tipo, duracaoMin: s.duracao_min },
    tentativaId: t.id,
    status: t.status,
    questoes,
    respostas: Object.fromEntries((resp ?? []).map((r) => [r.questao_id, r.alternativa as Letra | null])),
    prazoEm: t.prazo_em,
    restanteSeg,
    agoraServidor: agora.toISOString(),
  };
}

export async function responder(tentativaId: string, questaoId: string, alternativa: Letra | null) {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (t.status !== "em_andamento") return { ok: false as const, erro: "Prova já entregue.", encerrada: true };
  if (!t.ordem.includes(questaoId)) return { ok: false as const, erro: "Questão fora do simulado." };
  if (alternativa !== null && !["A", "B", "C", "D", "E"].includes(alternativa)) return { ok: false as const, erro: "Alternativa inválida." };
  const agora = new Date();
  const foraDoPrazo = s.tipo === "professor"
    ? !aceitaResposta(agora, t.prazo_em ? new Date(t.prazo_em) : null)
    : tempoEsgotado(acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora), s.duracao_min);
  if (foraDoPrazo) {
    await entregarTentativa(t.id);
    return { ok: false as const, erro: "O tempo acabou.", encerrada: true };
  }
  const { error } = await supabase.from("tentativa_respostas").upsert({ tentativa_id: t.id, questao_id: questaoId, alternativa, respondida_em: agora.toISOString() }, { onConflict: "tentativa_id,questao_id" });
  if (error) return { ok: false as const, erro: "Não foi possível salvar. Tentando de novo…", tentarDeNovo: true as const };
  return { ok: true as const };
}

export async function pulsoTreino(tentativaId: string) {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (s.tipo !== "treino" || t.status !== "em_andamento") return { restanteSeg: null, encerrada: t.status !== "em_andamento" };
  if (!s.duracao_min) return { restanteSeg: null, encerrada: false };
  const agora = new Date();
  const usado = acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, agora);
  await supabase.from("tentativas").update({ tempo_usado_seg: usado, ultimo_pulso_em: agora.toISOString() }).eq("id", t.id).eq("status", "em_andamento");
  if (tempoEsgotado(usado, s.duracao_min)) { await entregarTentativa(t.id); return { restanteSeg: 0, encerrada: true }; }
  return { restanteSeg: s.duracao_min * 60 - usado, encerrada: false };
}

export async function pausarTreino(tentativaId: string): Promise<void> {
  const aluno = await exigirAluno();
  const { t, s } = await tentativaDoAluno(aluno, tentativaId);
  if (s.tipo !== "treino" || t.status !== "em_andamento") return;
  const usado = acumularTempo(t.tempo_usado_seg, t.ultimo_pulso_em ? new Date(t.ultimo_pulso_em) : null, new Date());
  await supabase.from("tentativas").update({ tempo_usado_seg: usado, ultimo_pulso_em: null }).eq("id", t.id).eq("status", "em_andamento");
}

export async function entregar(tentativaId: string): Promise<void> {
  const aluno = await exigirAluno();
  const { t } = await tentativaDoAluno(aluno, tentativaId);
  await entregarTentativa(t.id);
}

export type ResultadoAluno =
  | { liberado: false; liberaEm: string | null }
  | { liberado: true; acertos: number; total: number; porcentagem: number; porArea: PorArea; itens: { questaoId: string; marcada: Letra | null; certa: Letra | null; anulada: boolean; correta: boolean }[] };

export async function resultadoAluno(simuladoId: string): Promise<ResultadoAluno | null> {
  const aluno = await exigirAluno();
  const s = await simuladoDoAluno(aluno, simuladoId);
  await fecharVencidas(s.id);
  const { data: t } = await supabase.from("tentativas").select("*").eq("simulado_id", s.id).eq("conta_id", aluno.id).maybeSingle();
  if (!t || t.status !== "entregue") return null;
  if (!correcaoLiberada(s, new Date())) return { liberado: false, liberaEm: s.fecha_em };
  const [{ data: resp }, { data: qs }] = await Promise.all([
    supabase.from("tentativa_respostas").select("questao_id, alternativa, correta").eq("tentativa_id", t.id),
    supabase.from("questoes").select("id, resposta, anulada").in("id", t.ordem),
  ]);
  const r = new Map((resp ?? []).map((x) => [x.questao_id, x]));
  const q = new Map((qs ?? []).map((x) => [x.id, x]));
  return {
    liberado: true,
    acertos: t.acertos ?? 0, total: t.total ?? 0, porcentagem: Number(t.porcentagem ?? 0), porArea: t.por_area ?? {},
    itens: t.ordem.map((id) => ({ questaoId: id, marcada: (r.get(id)?.alternativa as Letra | null) ?? null, certa: (q.get(id)?.resposta as Letra | null) ?? null, anulada: !!q.get(id)?.anulada, correta: !!r.get(id)?.correta })),
  };
}
