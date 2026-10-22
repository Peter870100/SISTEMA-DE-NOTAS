export const MEDIA_PADRAO = 6;
const ERRO_FAIXA = "A média precisa estar entre 0 e 10.";

function arredondar(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Número finito entre 0 e 10, com 1 casa; o resto vira a média padrão. */
export function normalizarMedia(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 10) return MEDIA_PADRAO;
  return arredondar(n);
}

/** Valida o texto digitado ("6", "6,5", "6.5"): devolve o número ou a mensagem de erro. */
export function validarMediaDigitada(texto: string): number | string {
  const limpo = texto.trim().replace(",", ".");
  if (!limpo) return "Informe a média.";
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0 || n > 10) return ERRO_FAIXA;
  return arredondar(n);
}

/** Lê a média da escola; sem a coluna (SQL ainda não aplicado) ou com erro, usa 6. */
export async function mediaAprovacaoDaEscola(escolaId: string): Promise<number> {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error } = await supabase.from("escolas").select("media_aprovacao").eq("id", escolaId).maybeSingle();
    if (error || !data) return MEDIA_PADRAO;
    return normalizarMedia((data as { media_aprovacao?: unknown }).media_aprovacao);
  } catch {
    return MEDIA_PADRAO;
  }
}
