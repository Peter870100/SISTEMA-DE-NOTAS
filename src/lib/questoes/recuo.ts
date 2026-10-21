// Recuo do parágrafo: 0 a 3 níveis (mesma faixa que `limparConteudo` aceita).

export const RECUO_MAXIMO = 3;

/** Ajusta o recuo atual em `passo` níveis; valor estranho vira 0 e o resultado fica entre 0 e RECUO_MAXIMO. */
export function mudarRecuo(atual: unknown, passo: 1 | -1): number {
  const n = typeof atual === "number" && Number.isFinite(atual) ? Math.floor(atual) : 0;
  const base = Math.min(RECUO_MAXIMO, Math.max(0, n));
  return Math.min(RECUO_MAXIMO, Math.max(0, base + passo));
}
