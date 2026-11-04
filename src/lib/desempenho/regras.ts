import { REGRAS_PADRAO } from "@/lib/plano/regras";
import type { RegrasAprendizagem } from "@/lib/plano/tipos";

/** Regras da escola mais o limite do gráfico (fixo). */
export type Regras = RegrasAprendizagem & { maxConteudosGrafico: number };

export const REGRAS: Regras = { ...REGRAS_PADRAO, maxConteudosGrafico: 8 };

export function regrasDoPainel(r: RegrasAprendizagem): Regras {
  return { ...r, maxConteudosGrafico: 8 };
}

export const AVISO_DIFICULDADE = "Atividades diferentes podem ter dificuldades diferentes.";

export const FRASE_INICIAL = "Os números mostram o desempenho inicial; os treinos do plano aparecem na evolução e no plano de estudo.";
