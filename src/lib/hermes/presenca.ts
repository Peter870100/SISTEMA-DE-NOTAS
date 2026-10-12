import { formatarDuracao } from "@/lib/simulados/regras";
import type { EventoSaida } from "@/lib/types";

export type Presenca = { saidas: number; tempoForaSeg: number; eventos: EventoSaida[] };
const MAX_FORA = 6 * 3600;
const MAX_EVENTOS = 200;

const inteiro = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);
const data = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

function eventos(v: unknown): EventoSaida[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) => {
    const saiu = data(e?.saiu_em);
    if (!saiu) return [];
    const q = typeof e?.questao === "number" && Number.isInteger(e.questao) && e.questao >= 1 ? e.questao : null;
    return [{ questao: q, saiu_em: saiu, voltou_em: data(e?.voltou_em) }];
  });
}

export function mesclarPresenca(salva: Partial<Presenca> | null, nova: unknown): Presenca {
  const n = (nova && typeof nova === "object" ? nova : {}) as Record<string, unknown>;
  const porSaida = new Map<string, EventoSaida>();
  for (const e of [...eventos(salva?.eventos), ...eventos(n.eventos)]) {
    const atual = porSaida.get(e.saiu_em);
    porSaida.set(e.saiu_em, atual && atual.voltou_em ? atual : e);
  }
  return {
    saidas: Math.max(inteiro(salva?.saidas, 1e6), inteiro(n.saidas, 1e6)),
    tempoForaSeg: Math.max(inteiro(salva?.tempoForaSeg, MAX_FORA), inteiro(n.tempoForaSeg, MAX_FORA)),
    eventos: [...porSaida.values()].sort((a, b) => a.saiu_em.localeCompare(b.saiu_em)).slice(-MAX_EVENTOS),
  };
}

export function formatarPresenca(saidas: number | null, foraSeg: number | null): string {
  if (saidas == null || foraSeg == null) return "—";
  if (saidas === 0) return "nenhuma";
  return `${saidas} ${saidas === 1 ? "saída" : "saídas"} · ${formatarDuracao(foraSeg)} fora`;
}
