"use server";

import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual, getProfessorAtual } from "@/lib/auth";
import {
  relatarErroCom,
  relatorDaSessao,
  responderExercicioCom,
  type DepsRelato,
  type DepsResposta,
  type EntradaRelato,
  type ResultadoResposta,
} from "@/lib/estudos/nucleo";
import type { Letra, SituacaoEstudo } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LETRAS: readonly string[] = ["A", "B", "C", "D", "E"];

/** Instante 00:00 de hoje em America/Sao_Paulo (UTC-3, sem horário de verão), em ISO. */
function inicioDoDiaSP(agora = new Date()): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return new Date(`${dia}T03:00:00.000Z`).toISOString();
}

export async function responderExercicio(e: { exercicioId: string; marcada: Letra }): Promise<ResultadoResposta> {
  try {
    const aluno = await getAlunoAtual();
    if (!aluno) return { ok: false, erro: "Faça login novamente." };
    if (!LETRAS.includes(e?.marcada) || typeof e?.exercicioId !== "string" || !UUID.test(e.exercicioId)) {
      return { ok: false, erro: "Resposta inválida." };
    }
    const deps: DepsResposta = {
      exercicio: async (id) => {
        const { data, error } = await supabase
          .from("exercicios_fixacao")
          .select("resposta_correta, comentario, situacao, material_id")
          .eq("id", id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return null;
        const { data: mat, error: e2 } = await supabase.from("materiais_estudo").select("situacao").eq("id", data.material_id).maybeSingle();
        if (e2) throw new Error(e2.message);
        if (!mat) return null;
        return { resposta_correta: data.resposta_correta, comentario: data.comentario, situacao: data.situacao, material_situacao: mat.situacao };
      },
      gravar: async (contaId, exercicioId, marcada, acertou) => {
        const { error } = await supabase
          .from("respostas_fixacao")
          .upsert({ conta_id: contaId, exercicio_id: exercicioId, marcada, acertou }, { onConflict: "conta_id,exercicio_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        const { data, error: e2 } = await supabase
          .from("respostas_fixacao")
          .select("marcada, acertou")
          .eq("conta_id", contaId)
          .eq("exercicio_id", exercicioId)
          .single();
        if (e2) throw new Error(e2.message);
        return { marcada: data.marcada, acertou: data.acertou };
      },
    };
    return await responderExercicioCom(deps, aluno.id, e);
  } catch (e) {
    console.error("responderExercicio:", e);
    return { ok: false, erro: "Não foi possível registrar a resposta." };
  }
}

async function situacaoDe(materialId: string, exercicioId: string | null): Promise<SituacaoEstudo | null> {
  const consulta = exercicioId
    ? supabase.from("exercicios_fixacao").select("situacao").eq("id", exercicioId).eq("material_id", materialId)
    : supabase.from("materiais_estudo").select("situacao").eq("id", materialId);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw new Error(error.message);
  return data?.situacao ?? null;
}

export async function relatarErro(e: EntradaRelato): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const aluno = await getAlunoAtual();
    const q = relatorDaSessao(aluno, aluno ? null : await getProfessorAtual());
    if (!q) return { ok: false, erro: "Faça login novamente." };
    if (typeof e?.materialId !== "string" || !UUID.test(e.materialId)) return { ok: false, erro: "Material inválido." };
    if (e.exercicioId !== null && (typeof e.exercicioId !== "string" || !UUID.test(e.exercicioId))) {
      return { ok: false, erro: "Exercício inválido." };
    }
    const mensagem = typeof e.mensagem === "string" && e.mensagem.trim() ? e.mensagem.trim() : null;
    const entrada: EntradaRelato = { materialId: e.materialId, exercicioId: e.exercicioId, mensagem };

    const deps: DepsRelato = {
      noAr: async (materialId, exercicioId) => (await situacaoDe(materialId, exercicioId)) === "publicado",
      relatoAnterior: async (quem, materialId, exercicioId) => {
        let c = supabase.from("relatos_erro").select("situacao").eq("material_id", materialId).in("situacao", ["aberto", "sem_erro"]);
        c = "conta_id" in quem ? c.eq("conta_id", quem.conta_id) : c.eq("professor_id", quem.professor_id);
        c = exercicioId ? c.eq("exercicio_id", exercicioId) : c.is("exercicio_id", null);
        const { data, error } = await c;
        if (error) throw new Error(error.message);
        const situacoes = (data ?? []).map((r) => r.situacao);
        return situacoes.includes("aberto") ? "aberto" : situacoes.includes("sem_erro") ? "sem_erro" : null;
      },
      relatosHoje: async (quem) => {
        let c = supabase.from("relatos_erro").select("id", { head: true, count: "exact" }).gte("criado_em", inicioDoDiaSP());
        c = "conta_id" in quem ? c.eq("conta_id", quem.conta_id) : c.eq("professor_id", quem.professor_id);
        const { count, error } = await c;
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
      inserir: async (quem, r) => {
        const { error } = await supabase.from("relatos_erro").insert({
          material_id: r.materialId,
          exercicio_id: r.exercicioId,
          mensagem: r.mensagem,
          ...("conta_id" in quem ? { conta_id: quem.conta_id } : { professor_id: quem.professor_id }),
        });
        if (error) throw new Error(error.message);
      },
      tirarDoAr: async (materialId, exercicioId) => {
        const alteracao = { situacao: "em_conferencia" as const };
        const { error } = exercicioId
          ? await supabase.from("exercicios_fixacao").update(alteracao).eq("id", exercicioId)
          : await supabase.from("materiais_estudo").update(alteracao).eq("id", materialId);
        if (error) throw new Error(error.message);
      },
    };
    return await relatarErroCom(deps, q, entrada);
  } catch (e2) {
    console.error("relatarErro:", e2);
    return { ok: false, erro: "Não foi possível enviar o aviso." };
  }
}
