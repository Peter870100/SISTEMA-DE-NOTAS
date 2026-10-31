import { markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";

const SOBRENOME_INICIAL = /^[A-ZÀ-Ý]{2,}(?:\s[A-ZÀ-Ý]{2,})*,\s/;

/** Parágrafo de fonte/crédito do texto-base ("SOBRENOME, N. ... Acesso em: ..."). */
export function ehCredito(paragrafo: string): boolean {
  const p = paragrafo.trim();
  if (!p) return false;
  if (/dispon[íi]vel em|acesso em/i.test(p) && p.length <= 300) return true;
  return SOBRENOME_INICIAL.test(p);
}

/** Número com dois dígitos: 1 → "01". */
export function numero2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Separa o crédito (último parágrafo não vazio, se for crédito) do corpo do enunciado.
 * O corpo vem em blocos de segmentos (um por linha), sem as linhas vazias do fim.
 */
export function separarCredito(enunciado: string): { corpo: Segmento[][]; credito: string | null } {
  const linhas = (enunciado ?? "").split(/\r?\n/);
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  let credito: string | null = null;
  if (linhas.length && ehCredito(linhas[linhas.length - 1])) {
    credito = linhas.pop()!.trim();
    while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  }
  return { corpo: markdownParaBlocos(linhas.join("\n")), credito };
}
