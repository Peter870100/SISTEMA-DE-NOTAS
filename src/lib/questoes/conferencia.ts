import type { Alinhamento } from "@/lib/types";

/** Valor de justify-content para posicionar a figura da questão na linha. */
export function justificarAlinhamento(a: Alinhamento): "flex-start" | "center" | "flex-end" {
  if (a === "esquerda") return "flex-start";
  if (a === "direita") return "flex-end";
  return "center";
}
