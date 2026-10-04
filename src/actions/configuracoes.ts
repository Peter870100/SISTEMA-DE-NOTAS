"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdmin, getProfessorAtual } from "@/lib/auth";

export async function atualizarCodigoConvite(novoCodigo: string): Promise<void> {
  await exigirAdmin();

  const codigoLimpo = novoCodigo.trim();
  if (!codigoLimpo) throw new Error("Informe um código.");

  const professor = await getProfessorAtual();
  const { error } = await supabase
    .from("escolas")
    .update({ codigo_convite_professor: codigoLimpo })
    .eq("id", professor!.escola_id);
  if (error) throw new Error(error.message);
}
