import { supabase } from "@/lib/supabase/client";

export const BUCKET = "questoes";
const EXIBICAO_SEG = 300;
const IA_SEG = 259200; // 72 h: o lote pode demorar

async function assinar(path: string, segundos: number): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar link.");
  return data.signedUrl;
}

export const linkExibicao = (path: string) => assinar(path, EXIBICAO_SEG);
export const linkParaIA = (path: string) => assinar(path, IA_SEG);

export async function linksExibicao(paths: string[], segundos = EXIBICAO_SEG): Promise<Map<string, string>> {
  const unicos = [...new Set(paths)];
  if (unicos.length === 0) return new Map();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, segundos);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}
