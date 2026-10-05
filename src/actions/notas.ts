"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessorLogado, exigirColunaDaEscola, exigirAlunoDaEscola } from "@/lib/escola-acesso";
import type { ValorCelula } from "@/lib/status";

export async function upsertCelula(
  alunoId: string,
  colunaId: string,
  patch: ValorCelula
): Promise<{ atualizadoPorNome: string | null; atualizadoEm: string }> {
  const professor = await exigirProfessorLogado();
  const [{ coluna, turma }, { aluno }] = await Promise.all([
    exigirColunaDaEscola(professor, colunaId),
    exigirAlunoDaEscola(professor, alunoId),
  ]);
  if (aluno.turma_id !== coluna.turma_id) throw new Error("Aluno e atividade de turmas diferentes.");
  if (turma.bimestre_encerrado) throw new Error("Bimestre encerrado. Reabra o bimestre para fazer lançamentos.");

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
      atualizado_por: professor.id,
    },
    { onConflict: "aluno_id,coluna_id" }
  );
  if (error) throw new Error(error.message);

  const mudou = (atual?.valor ?? null) !== (patch.valor ?? null) || (atual?.status_texto ?? null) !== (patch.status_texto ?? null);
  if (professor.role === "professor" && mudou) {
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

  return { atualizadoPorNome: professor.nome, atualizadoEm: new Date().toISOString() };
}
