"use server";

import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import type { ValorCelula } from "@/lib/status";

export async function upsertCelula(
  alunoId: string,
  colunaId: string,
  patch: ValorCelula
): Promise<{ atualizadoPorNome: string | null; atualizadoEm: string }> {
  const professor = await getProfessorAtual();

  if (professor) {
    const { data: coluna } = await supabase
      .from("atividades_colunas")
      .select("turma_id")
      .eq("id", colunaId)
      .single();
    const { data: turma } = coluna
      ? await supabase.from("turmas").select("nome").eq("id", coluna.turma_id).single()
      : { data: null };
    if (!turma || !(await professorTemAcessoATurma(professor, turma.nome))) {
      throw new Error("Você não tem acesso a essa turma.");
    }
  }

  const { data: atual } = await supabase
    .from("notas_celulas")
    .select("valor, status_texto")
    .eq("aluno_id", alunoId)
    .eq("coluna_id", colunaId)
    .maybeSingle();

  const { error } = await supabase.from("notas_celulas").upsert(
    {
      aluno_id: alunoId,
      coluna_id: colunaId,
      valor: patch.valor,
      status_texto: patch.status_texto,
      atualizado_por: professor?.id ?? null,
    },
    { onConflict: "aluno_id,coluna_id" }
  );
  if (error) throw new Error(error.message);

  const mudou = (atual?.valor ?? null) !== (patch.valor ?? null) || (atual?.status_texto ?? null) !== (patch.status_texto ?? null);
  if (professor?.role === "professor" && mudou) {
    await supabase.from("notas_historico").insert({
      aluno_id: alunoId,
      coluna_id: colunaId,
      valor_anterior: atual?.valor ?? null,
      status_anterior: atual?.status_texto ?? null,
      valor_novo: patch.valor,
      status_novo: patch.status_texto,
      alterado_por: professor.id,
    });
  }

  return { atualizadoPorNome: professor?.nome ?? null, atualizadoEm: new Date().toISOString() };
}
