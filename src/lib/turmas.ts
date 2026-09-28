const PADRAO_SERIE = /^(\d+)ª\s*série\s*(.*)$/i;

/** Extrai o grupo de série (ex: "1ª série") e o restante do nome (ex: "A") de um nome de turma. */
export function partesDaTurma(nome: string): { serie: string; resto: string } {
  const m = nome.trim().match(PADRAO_SERIE);
  if (!m) return { serie: "Outras turmas", resto: nome };
  return { serie: `${m[1]}ª série`, resto: m[2].trim() };
}

const CORES_BIMESTRE: Record<string, string> = {
  "1º Bimestre": "bg-brand-bright/10 text-brand-bright",
  "2º Bimestre": "bg-ok/10 text-ok",
  "3º Bimestre": "bg-gold/40 text-gold-ink",
  "4º Bimestre": "bg-warn/10 text-warn",
};

export function corBimestre(bimestre: string): string {
  return CORES_BIMESTRE[bimestre] ?? "bg-surface-sunken text-muted";
}
