import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho Authorization ("Bearer <senha>") com a senha esperada, em tempo constante.
 * Compara os SHA-256 dos dois (mesmo tamanho), assim nem o tamanho da senha vaza. Senha ausente = recusa.
 */
export function senhaConfere(cabecalho: string | null, esperada: string | undefined): boolean {
  if (!esperada || !cabecalho) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(cabecalho), h(`Bearer ${esperada}`));
}
