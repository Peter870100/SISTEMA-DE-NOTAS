import { supabase } from "@/lib/supabase/client";

/** Código de convite atual exigido no cadastro público (linha única em `configuracoes`). */
export async function obterCodigoConvite(): Promise<string | null> {
  const { data } = await supabase
    .from("configuracoes")
    .select("codigo_convite")
    .eq("id", true)
    .maybeSingle();
  return data?.codigo_convite ?? null;
}
