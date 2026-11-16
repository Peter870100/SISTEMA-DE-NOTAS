/** Regras puras do "Refazer as erradas" do plano de estudo. */

/** Máximo de questões num treino de refazer. */
export const MAX_REFAZER = 10;

export function ehRefazer(etapa: string | null | undefined): boolean {
  return etapa === "refazer";
}

export type ErradaInicial = { questaoId: string; erradaEm: string };

/**
 * Questões ainda pendentes de refazer: sem repetição, mostráveis e não refeitas,
 * do erro mais recente para o mais antigo (empate pela data: id crescente).
 * Questão repetida fica com a data mais recente.
 */
export function pendentesRefazer(erradas: ErradaInicial[], refeitas: ReadonlySet<string>, mostraveis: ReadonlySet<string>): string[] {
  const recente = new Map<string, string>();
  for (const e of erradas) {
    const atual = recente.get(e.questaoId);
    if (atual === undefined || e.erradaEm > atual) recente.set(e.questaoId, e.erradaEm);
  }
  return [...recente.entries()]
    .filter(([id]) => mostraveis.has(id) && !refeitas.has(id))
    .sort(([ia, da], [ib, db]) => (da === db ? (ia < ib ? -1 : ia > ib ? 1 : 0) : da < db ? 1 : -1))
    .map(([id]) => id);
}
