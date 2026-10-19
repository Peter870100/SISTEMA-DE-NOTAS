import type { Alinhamento, Questao } from "@/lib/types";
import { limitarQuadro, type Quadro } from "./quadro";

/** Valor de justify-content para posicionar a figura da questão na linha. */
export function justificarAlinhamento(a: Alinhamento): "flex-start" | "center" | "flex-end" {
  if (a === "esquerda") return "flex-start";
  if (a === "direita") return "flex-end";
  return "center";
}

export type EstadoConferencia = "a_conferir" | "conferida" | "falta_imagem";
export type FiltroConferencia = "a-conferir" | "falta-imagem" | "conferidas";

/** Estado da questão na conferência: "falta imagem" vence a data de conferência. */
export function estadoConferencia(q: Pick<Questao, "falta_imagem" | "conferida_em">): EstadoConferencia {
  if (q.falta_imagem) return "falta_imagem";
  return q.conferida_em ? "conferida" : "a_conferir";
}

/** Campos gravados ao marcar a questão como "falta imagem". */
export function camposFaltaImagem(): { status: "revisao"; falta_imagem: true; conferida_em: null } {
  return { status: "revisao", falta_imagem: true, conferida_em: null };
}

/** Campos gravados ao marcar a questão como conferida (publica). */
export function camposConferida(agora: Date): {
  status: "publicada";
  falta_imagem: false;
  conferida_em: string;
  precisa_revisao: false;
} {
  return { status: "publicada", falta_imagem: false, conferida_em: agora.toISOString(), precisa_revisao: false };
}

/** Id da página anterior (-1) ou seguinte (1) por `numero`; null nas pontas ou se não estiver na lista. */
export function paginaVizinha(
  paginas: { id: string; numero: number }[],
  atualId: string,
  direcao: -1 | 1,
): string | null {
  const ordenadas = [...paginas].sort((a, b) => a.numero - b.numero);
  const i = ordenadas.findIndex((p) => p.id === atualId);
  if (i < 0) return null;
  return ordenadas[i + direcao]?.id ?? null;
}

/** Retângulo entre dois pontos (qualquer direção); null se largura ou altura < 0,01. */
export function quadroDoArraste(a: { x: number; y: number }, b: { x: number; y: number }): Quadro | null {
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  if (w < 0.01 || h < 0.01) return null;
  return limitarQuadro({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h });
}

/** Região em pixels (inteiros, mínimo 1x1) de um quadro em frações sobre uma imagem largura x altura. */
export function pixelsDoQuadro(
  q: Quadro,
  largura: number,
  altura: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = Math.min(Math.max(Math.round(q.x * largura), 0), Math.max(largura - 1, 0));
  const sy = Math.min(Math.max(Math.round(q.y * altura), 0), Math.max(altura - 1, 0));
  const sw = Math.max(1, Math.min(Math.round(q.w * largura), largura - sx));
  const sh = Math.max(1, Math.min(Math.round(q.h * altura), altura - sy));
  return { sx, sy, sw, sh };
}
