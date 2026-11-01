import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";

/** Quadro em frações da página -> retângulo em pixels (inteiros, dentro da página, lados ≥ 1). */
export function pixelsDoRecorte(q: Quadro, largura: number, altura: number) {
  const f = limitarQuadro(q);
  const left = Math.min(largura - 1, Math.max(0, Math.round(f.x * largura)));
  const top = Math.min(altura - 1, Math.max(0, Math.round(f.y * altura)));
  const width = Math.max(1, Math.min(largura - left, Math.round(f.w * largura)));
  const height = Math.max(1, Math.min(altura - top, Math.round(f.h * altura)));
  return { left, top, width, height };
}
