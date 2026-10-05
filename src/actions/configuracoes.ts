"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola } from "@/lib/escola-acesso";

export async function atualizarCodigoConvite(novoCodigo: string): Promise<void> {
  const admin = await exigirAdminDaEscola();

  const codigoLimpo = novoCodigo.trim();
  if (!codigoLimpo) throw new Error("Informe um código.");

  const { error } = await supabase
    .from("escolas")
    .update({ codigo_convite_professor: codigoLimpo })
    .eq("id", admin.escola_id);
  if (error) throw new Error(error.message);
}
