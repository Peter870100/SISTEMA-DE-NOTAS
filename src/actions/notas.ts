"use server";

import { supabase } from "@/lib/supabase/client";
import type { ValorCelula } from "@/lib/status";

export async function upsertCelula(
  alunoId: string,
  colunaId: string,
  patch: ValorCelula
) {
  const { error } = await supabase.from("notas_celulas").upsert(
    {
      aluno_id: alunoId,
      coluna_id: colunaId,
      valor: patch.valor,
      status_texto: patch.status_texto,
    },
    { onConflict: "aluno_id,coluna_id" }
  );
  if (error) throw new Error(error.message);
}
