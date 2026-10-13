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
  const mesclados = [...porSaida.values()].sort((a, b) => a.saiu_em.localeCompare(b.saiu_em));
  return {
    saidas: Math.max(inteiro(salva?.saidas, 1e6), inteiro(n.saidas, 1e6), mesclados.length),
    tempoForaSeg: Math.max(inteiro(salva?.tempoForaSeg, MAX_FORA), inteiro(n.tempoForaSeg, MAX_FORA)),
    eventos: mesclados.slice(-MAX_EVENTOS),
  };
}

const MAX_SAIDA_PENDENTE_SEG = 30 * 60;

/** Fecha a saída que ficou aberta (recarregou/fechou a aba). Acima de 30 min, não conta como tempo fora. */
export function fecharSaidaPendente(p: Presenca, agora: Date): Presenca {
  const ultimo = p.eventos[p.eventos.length - 1];
  if (!ultimo || ultimo.voltou_em !== null) return p;
  const seg = Math.max(0, Math.round((agora.getTime() - Date.parse(ultimo.saiu_em)) / 1000));
  return {
    ...p,
    eventos: [...p.eventos.slice(0, -1), { ...ultimo, voltou_em: agora.toISOString() }],
    tempoForaSeg: seg <= MAX_SAIDA_PENDENTE_SEG ? p.tempoForaSeg + seg : p.tempoForaSeg,
  };
}

export function formatarPresenca(saidas: number | null, foraSeg: number | null): string {
  if (saidas == null || foraSeg == null) return "—";
  if (saidas === 0) return "nenhuma";
  return `${saidas} ${saidas === 1 ? "saída" : "saídas"} · ${formatarDuracao(foraSeg)} fora`;
}

/** Tentativa sem medição de presença (anterior ao recurso): nenhuma saída registrada e nenhum evento guardado. */
export function semMedicaoDePresenca(t: { saidas: number | null; eventos_saida?: unknown[] | null }): boolean {
  return t.eventos_saida === null && (t.saidas ?? 0) === 0;
}

/** Texto de presença de uma tentativa: "—" quando não houve medição. */
export function presencaTentativa(t: { saidas: number | null; tempo_fora_seg: number | null; eventos_saida?: unknown[] | null }): string {
  if (semMedicaoDePresenca(t)) return "—";
  return formatarPresenca(t.saidas ?? null, t.tempo_fora_seg ?? null);
}

const delta = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);

/** Soma os deltas de uma visita à aula ao que já estava gravado; cada delta tem teto contra envio errado. */
export function somarPresencaAula(
  salvo: { tempo_assistido_seg: number; saidas: number; tempo_fora_seg: number },
  extra: unknown
): { tempo_assistido_seg: number; saidas: number; tempo_fora_seg: number } {
  const e = (extra && typeof extra === "object" ? extra : {}) as Record<string, unknown>;
  return {
    tempo_assistido_seg: salvo.tempo_assistido_seg + delta(e.assistidoDeltaSeg, 120),
    saidas: salvo.saidas + delta(e.saidasDelta, 20),
    tempo_fora_seg: salvo.tempo_fora_seg + delta(e.foraDeltaSeg, 3600),
  };
}
