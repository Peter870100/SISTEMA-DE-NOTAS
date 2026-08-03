"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdmin } from "@/lib/auth";

export async function atualizarCodigoConvite(novoCodigo: string): Promise<void> {
  await exigirAdmin();

  const codigoLimpo = novoCodigo.trim();
  if (!codigoLimpo) throw new Error("Informe um código.");

  const { error } = await supabase
    .from("configuracoes")
    .update({ codigo_convite: codigoLimpo })
    .eq("id", true);
  if (error) throw new Error(error.message);
}
