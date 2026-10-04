export type Quadro = { x: number; y: number; w: number; h: number };
const MINIMO = 0.01;

function numero(v: number, padrao: number): number {
  return Number.isFinite(v) ? v : padrao;
}

/** Quadro dentro da página: frações em [0,1], x+w ≤ 1, y+h ≤ 1, lados ≥ 0,01. */
export function limitarQuadro(q: Quadro): Quadro {
  const x = Math.min(1 - MINIMO, Math.max(0, numero(q.x, 0)));
  const y = Math.min(1 - MINIMO, Math.max(0, numero(q.y, 0)));
  const w = Math.min(1 - x, Math.max(MINIMO, numero(q.w, MINIMO)));
  const h = Math.min(1 - y, Math.max(MINIMO, numero(q.h, MINIMO)));
  const arred = (n: number) => Math.round(n * 100000) / 100000;
  return { x: arred(x), y: arred(y), w: arred(w), h: arred(h) };
}

const pct = (n: number) => `${Number(n.toFixed(4))}%`;

/** CSS para mostrar só o recorte de uma imagem de página (background-image). */
export function estiloRecorte(q: Quadro, largura: number, altura: number) {
  const posX = q.w >= 1 ? 0 : (q.x / (1 - q.w)) * 100;
  const posY = q.h >= 1 ? 0 : (q.y / (1 - q.h)) * 100;
  return {
    backgroundSize: `${pct(100 / q.w).replace("%", "")}% auto`,
    backgroundPosition: `${pct(posX)} ${pct(posY)}`,
    aspectRatio: `${Math.round(q.w * largura)} / ${Math.round(q.h * altura)}`,
  };
}
