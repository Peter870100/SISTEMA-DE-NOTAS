const PADRAO_SERIE = /^(\d+)ª\s*série\s*(.*)$/i;

/** Extrai o grupo de série (ex: "1ª série") e o restante do nome (ex: "A") de um nome de turma. */
export function partesDaTurma(nome: string): { serie: string; resto: string } {
  const m = nome.trim().match(PADRAO_SERIE);
  if (!m) return { serie: "Outras turmas", resto: nome };
  return { serie: `${m[1]}ª série`, resto: m[2].trim() };
}

const CORES_BIMESTRE: Record<string, string> = {
  "1º Bimestre": "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  "2º Bimestre": "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  "3º Bimestre": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "4º Bimestre": "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

export function corBimestre(bimestre: string): string {
  return (
    CORES_BIMESTRE[bimestre] ??
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
  );
}
