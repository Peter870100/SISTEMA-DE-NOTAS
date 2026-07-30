"use server";

import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual } from "@/lib/auth";
import type { ValorCelula } from "@/lib/status";

export async function upsertCelula(
  alunoId: string,
  colunaId: string,
  patch: ValorCelula
): Promise<{ atualizadoPorNome: string | null; atualizadoEm: string }> {
  const professor = await getProfessorAtual();

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

  return { atualizadoPorNome: professor?.nome ?? null, atualizadoEm: new Date().toISOString() };
}
