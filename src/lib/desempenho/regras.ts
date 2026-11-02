import type { ConteudoDesempenho } from "./tipos";

/** Limites das prioridades e do gráfico; mude aqui para ajustar o painel. */
export const REGRAS = { minQuestoesPrioridade: 5, taxaErroPrioridade: 60, maxConteudosGrafico: 8 } as const;
export type Regras = typeof REGRAS;

export const AVISO_DIFICULDADE = "Atividades diferentes podem ter dificuldades diferentes.";

const q = (n: number) => (n === 1 ? "questão" : "questões");

/** Sugestão de revisão (nunca diagnóstico). */
export function textoRevisar(c: Pick<ConteudoDesempenho, "nome" | "erros" | "questoes">): string {
  return `Você errou ${c.erros} de ${c.questoes} ${q(c.questoes)} de ${c.nome}. Vale revisar esse assunto e depois treinar com questões novas.`;
}

/** Poucas respostas para concluir algo: pede mais prática. */
export function textoMaisRespostas(c: Pick<ConteudoDesempenho, "nome" | "erros" | "questoes">): string {
  return `Você respondeu só ${c.questoes} ${q(c.questoes)} de ${c.nome} e errou ${c.erros}. Responda mais questões desse assunto para ver como você está.`;
}
