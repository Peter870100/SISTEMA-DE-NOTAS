export type GrupoMateria<T> = { materia: string; itens: T[] };

/**
 * Agrupa os conteúdos do plano pela matéria, mantendo a ordem do plano:
 * as matérias aparecem na ordem do seu primeiro conteúdo e, dentro de cada uma,
 * os conteúdos seguem a ordem original.
 */
export function agruparPorMateria<T extends { materiaRotulo: string }>(lista: readonly T[]): GrupoMateria<T>[] {
  const grupos = new Map<string, T[]>();
  for (const c of lista) {
    const materia = c.materiaRotulo.trim() || "Outros";
    const itens = grupos.get(materia);
    if (itens) itens.push(c);
    else grupos.set(materia, [c]);
  }
  return [...grupos].map(([materia, itens]) => ({ materia, itens }));
}

export function textoQuantidadeConteudos(n: number): string {
  return n === 1 ? "1 conteúdo" : `${n} conteúdos`;
}
