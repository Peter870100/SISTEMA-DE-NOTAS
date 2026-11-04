import { REGRAS_PADRAO, normalizarRegras } from "./regras";
import type { RegrasAprendizagem } from "./tipos";

/** Lê as regras da escola; sem a coluna (SQL ainda não aplicado) ou com erro, usa o padrão. */
export async function regrasDaEscola(escolaId: string): Promise<RegrasAprendizagem> {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error } = await supabase.from("escolas").select("regras_aprendizagem").eq("id", escolaId).maybeSingle();
    if (error || !data) return REGRAS_PADRAO;
    return normalizarRegras((data as { regras_aprendizagem?: unknown }).regras_aprendizagem);
  } catch {
    return REGRAS_PADRAO;
  }
}

/** Grava as regras da escola (`null` volta ao padrão). Lança em caso de erro. */
export async function gravarRegrasDaEscola(escolaId: string, regras: RegrasAprendizagem | null): Promise<void> {
  const { supabase } = await import("@/lib/supabase/client");
  const { error } = await supabase.from("escolas").update({ regras_aprendizagem: regras }).eq("id", escolaId);
  if (error) throw new Error(error.message);
}
