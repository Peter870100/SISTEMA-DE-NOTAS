"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola } from "@/lib/escola-acesso";
import { validarMediaDigitada } from "@/lib/relatorios/media";

export async function salvarMediaAprovacao(valor: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const admin = await exigirAdminDaEscola();
  const media = validarMediaDigitada(valor);
  if (typeof media === "string") return { ok: false, erro: media };

  const { error } = await supabase.from("escolas").update({ media_aprovacao: media } as never).eq("id", admin.escola_id);
  if (error) {
    const faltaColuna = error.code === "42703" || error.code === "PGRST204" || /media_aprovacao/i.test(error.message);
    return { ok: false, erro: faltaColuna ? "A média ainda não pode ser salva: falta atualizar o banco." : "Não foi possível salvar a média." };
  }
  revalidatePath("/configuracoes");
  return { ok: true };
}
