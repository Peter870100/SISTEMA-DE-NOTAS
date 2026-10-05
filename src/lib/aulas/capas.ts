export const BUCKET_CAPAS = "capas";
export const LIMITE_CAPA = 2 * 1024 * 1024;
export const TIPOS_CAPA = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type TipoCapa = "curso" | "aula";
export function validarCapa(tipo: string, tamanho: number): string | null {
  if (!Object.hasOwn(TIPOS_CAPA, tipo)) return "Envie uma imagem PNG, JPG ou WebP.";
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > LIMITE_CAPA) return "Não foi possível preparar a imagem para envio. Escolha novamente.";
  return null;
}
export function caminhoCapaValido(caminho: string, escolaId: string, professorId: string, tipo: TipoCapa): boolean {
  const prefixo = escolaId + "/capas/" + professorId + "/" + tipo + "-";
  return caminho.startsWith(prefixo) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(caminho.slice(prefixo.length));
}
export function urlCapa(caminho: string | null | undefined): string | null {
  return caminho ? process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/" + BUCKET_CAPAS + "/" + caminho : null;
}
export function thumbnailAula(caminho: string | null | undefined, videoId: string | null): string | null {
  return urlCapa(caminho) ?? (videoId && /^[\w-]{11}$/.test(videoId) ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg" : null);
}
export function assinaturaImagemValida(bytes: Uint8Array, extensao: string): boolean {
  if (extensao === "png") return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (extensao === "jpg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (extensao === "webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
