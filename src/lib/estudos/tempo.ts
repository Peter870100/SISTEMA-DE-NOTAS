const PALAVRAS_POR_MINUTO = 150;
const MINUTOS_POR_EXERCICIO = 2;

/** Tempo estimado de estudo, arredondado para cima de 5 em 5 minutos (mínimo 5). */
export function minutosDoEstudo(palavras: number, exercicios: number): number {
  const bruto = palavras / PALAVRAS_POR_MINUTO + exercicios * MINUTOS_POR_EXERCICIO;
  return Math.max(5, Math.ceil(bruto / 5) * 5);
}
