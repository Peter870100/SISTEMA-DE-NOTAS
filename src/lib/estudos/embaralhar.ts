/** Fisher–Yates: preserva os itens e sorteia uma nova ordem. */
export function embaralhar<T>(itens: readonly T[], sortear: () => number = Math.random): T[] {
  const resultado = [...itens];
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
}
