import type { AtividadeColuna } from "./types";
import type { ValorCelula } from "./status";

export const NOTA_MAXIMA = 1000;
export const ESCALA_EXIBICAO = 10;
export const LIMIAR_CRITICO = 6;

/** Converte uma nota/média da escala 0-1000 (planilha original) para 0-10. */
export function paraEscala10(valor: number): number {
  return (valor / NOTA_MAXIMA) * ESCALA_EXIBICAO;
}

export function mediaDeValores(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export function mediaAluno(
  celulasAluno: Record<string, ValorCelula> | undefined
): number | null {
  if (!celulasAluno) return null;
  const valores = Object.values(celulasAluno)
    .map((c) => c.valor)
    .filter((v): v is number => v !== null);
  return mediaDeValores(valores);
}

/** % de presença (P) entre as chamadas (colunas tipo 'presenca') já lançadas pro aluno. */
export function frequenciaAluno(
  colunasPresenca: AtividadeColuna[],
  celulasAluno: Record<string, ValorCelula> | undefined
): number | null {
  if (!celulasAluno) return null;
  let presentes = 0;
  let total = 0;
  for (const coluna of colunasPresenca) {
    const status = celulasAluno[coluna.id]?.status_texto?.trim().toUpperCase();
    if (status === "P" || status === "F") {
      total++;
      if (status === "P") presentes++;
    }
  }
  return total === 0 ? null : (presentes / total) * 100;
}

/**
 * Diferença entre a média das últimas `janela` atividades lançadas (em ordem)
 * e a média geral do aluno no bimestre — indica se ele está melhorando ou piorando.
 * Retorna null quando não há atividades suficientes para uma tendência confiável.
 */
export function indicadorTendencia(
  colunas: AtividadeColuna[],
  celulasAluno: Record<string, ValorCelula> | undefined,
  janela = 2
): number | null {
  if (!celulasAluno) return null;
  const ordenadas = [...colunas].sort((a, b) => a.ordem - b.ordem);
  const preenchidas = ordenadas
    .map((c) => celulasAluno[c.id]?.valor)
    .filter((v): v is number => v !== null && v !== undefined);

  if (preenchidas.length < janela + 1) return null;

  const geral = mediaDeValores(preenchidas);
  const ultimas = mediaDeValores(preenchidas.slice(-janela));
  if (geral === null || ultimas === null) return null;
  return ultimas - geral;
}
