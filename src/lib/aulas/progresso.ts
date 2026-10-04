import type { RegraGabarito } from "@/lib/types";

export const LIMIAR_CONCLUSAO = 0.9;
export const DURACAO_MAXIMA_SEG = 21600;
const FOLGA_SEG = 20;

export type ProgressoAnterior = { maior_posicao_seg: number; atualizado_em: string; concluida_em: string | null } | null;

/**
 * Novo progresso a partir do que o player informou. O maior ponto assistido só avança no
 * ritmo do relógio (até 2x + folga), então arrastar o vídeo até o fim não conclui a aula.
 * A posição de retomar guarda o que foi informado. Null se a duração for inválida.
 */
export function calcularProgresso(anterior: ProgressoAnterior, posicao: number, duracao: number, agora = Date.now()) {
  const duracaoSeg = Math.round(duracao);
  if (!Number.isFinite(duracaoSeg) || duracaoSeg < 1 || duracaoSeg > DURACAO_MAXIMA_SEG) return null;
  const posicaoSeg = Number.isFinite(posicao) ? Math.min(duracaoSeg, Math.max(0, Math.round(posicao))) : 0;

  const maiorAnterior = anterior?.maior_posicao_seg ?? 0;
  const segundosPassados = anterior ? Math.max(0, (agora - Date.parse(anterior.atualizado_em)) / 1000) : 0;
  const limite = Math.floor(anterior ? maiorAnterior + segundosPassados * 2 + FOLGA_SEG : FOLGA_SEG);
  const maior = Math.min(duracaoSeg, Math.max(maiorAnterior, Math.min(posicaoSeg, limite)));

  return {
    posicao_seg: posicaoSeg,
    maior_posicao_seg: maior,
    duracao_seg: duracaoSeg,
    concluir: !anterior?.concluida_em && maior >= LIMIAR_CONCLUSAO * duracaoSeg,
  };
}

export function porcentagemAula(p: { maior_posicao_seg: number; duracao_seg: number | null; concluida_em: string | null } | null): number {
  if (!p) return 0;
  if (p.concluida_em) return 100;
  if (!p.duracao_seg) return 0;
  return Math.min(100, Math.round((100 * p.maior_posicao_seg) / p.duracao_seg));
}

export function porcentagemConjunto(concluidas: number, total: number): number {
  return total > 0 ? Math.round((100 * concluidas) / total) : 0;
}

export type EstadoAula = "concluida" | "andamento" | "nao_iniciada";

export function estadoAula(p: { maior_posicao_seg: number; concluida_em: string | null } | null): EstadoAula {
  if (p?.concluida_em) return "concluida";
  return p && p.maior_posicao_seg > 0 ? "andamento" : "nao_iniciada";
}

export function gabaritoLiberado(regra: RegraGabarito, liberaEm: string | null, concluida: boolean, agora = Date.now()): boolean {
  if (regra === "junto") return true;
  if (regra === "apos_concluir") return concluida;
  return liberaEm !== null && agora >= Date.parse(liberaEm);
}
