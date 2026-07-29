export const STATUS_SUGESTOES = [
  "OK",
  "NF",
  "FALTOU",
  "NÃO FEZ",
  "ESTAVA FAZENDO PROVA",
] as const;

/** Opções de uma coluna de presença (chamada diária) — só isso, nada de nota numérica. */
export const STATUS_PRESENCA = ["P", "F"] as const;

export type ClasseStatus = "positivo" | "negativo" | "neutro";

export function classificarStatus(texto: string): ClasseStatus {
  const t = texto.trim().toLowerCase();
  if (t === "ok" || t === "p") return "positivo";
  if (t.startsWith("falt") || t === "nf" || t === "f" || t.includes("fez")) return "negativo";
  return "neutro";
}

/**
 * Badge neutro para status em texto livre (ok, NF, FALTOU, etc.) — a cor
 * vermelha fica reservada só para média crítica e o painel de alunos em risco.
 */
export function corStatus(): string {
  return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
}

/** Badge verde/vermelho pra presença — aqui a cor ajuda a bater o olho na chamada do dia. */
export function corPresenca(status: string): string {
  const s = status.trim().toUpperCase();
  if (s === "P") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s === "F") return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  return corStatus();
}

export type ValorCelula = { valor: number | null; status_texto: string | null };

export function parseEntradaCelula(raw: string): ValorCelula {
  const trimmed = raw.trim();
  if (trimmed === "") return { valor: null, status_texto: null };

  const numerico = trimmed.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(numerico)) {
    return { valor: Number(numerico), status_texto: null };
  }
  return { valor: null, status_texto: trimmed };
}
