import { cache } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Escola } from "@/lib/types";

export const ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001";

export const obterEscola = cache(async (id: string): Promise<Escola> => {
  const { data, error } = await supabase.from("escolas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Escola não encontrada.");
  return data;
});

/** Escola das telas antes do login (por enquanto, sempre o Colégio Status). */
export const obterEscolaPadrao = cache(() => obterEscola(ESCOLA_PADRAO_ID));
