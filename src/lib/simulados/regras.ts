import type { Area, Letra, PorArea, Simulado } from "@/lib/types";

export const TOLERANCIA_SEG = 30;
export const PULSO_SEG = 15;
export const LACUNA_MAX_SEG = 20;
export const MAX_TREINO = 90;

export function prazoFinal(iniciadaEm: Date, duracaoMin: number | null, fechaEm: Date | null): Date | null {
  const porDuracao = duracaoMin ? new Date(iniciadaEm.getTime() + duracaoMin * 60_000) : null;
  if (porDuracao && fechaEm) return porDuracao < fechaEm ? porDuracao : fechaEm;
  return porDuracao ?? fechaEm ?? null;
}

export function aceitaResposta(agora: Date, prazoEm: Date | null): boolean {
  return !prazoEm || agora.getTime() <= prazoEm.getTime() + TOLERANCIA_SEG * 1000;
}

/** Soma o tempo desde o último pulso, no máximo 20 s (lacunas maiores = página fechada/pausada). */
export function acumularTempo(tempoUsadoSeg: number, ultimoPulso: Date | null, agora: Date): number {
  if (!ultimoPulso) return tempoUsadoSeg;
  const passou = Math.max(0, (agora.getTime() - ultimoPulso.getTime()) / 1000);
  return Math.round(tempoUsadoSeg + Math.min(passou, LACUNA_MAX_SEG));
}

export function tempoEsgotado(tempoUsadoSeg: number, duracaoMin: number | null): boolean {
  return !!duracaoMin && tempoUsadoSeg >= duracaoMin * 60;
}

export type Gabarito = Map<string, { resposta: Letra | null; anulada: boolean; area: Area }>;

export function corrigir(respostas: Map<string, Letra | null>, gabarito: Gabarito) {
  const corretas = new Map<string, boolean>();
  const porArea: PorArea = {};
  let acertos = 0;
  for (const [id, g] of gabarito) {
    const certa = g.anulada || (!!g.resposta && respostas.get(id) === g.resposta);
    corretas.set(id, certa);
    const a = (porArea[g.area] ??= { acertos: 0, total: 0 });
    a.total++;
    if (certa) { a.acertos++; acertos++; }
  }
  const total = gabarito.size;
  const porcentagem = total ? Math.round((10000 * acertos) / total) / 100 : 0;
  return { acertos, total, porcentagem, porArea, corretas };
}

export function correcaoLiberada(s: Pick<Simulado, "tipo" | "correcao" | "fecha_em">, agora: Date): boolean {
  if (s.tipo === "treino" || s.correcao === "na_hora") return true;
  return !!s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em);
}

/** PRNG determinístico (mulberry32) a partir de um hash da semente. */
function gerador(semente: string): () => number {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) { h = Math.imul(h ^ semente.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ordemEmbaralhada(ids: string[], semente: string): string[] {
  const r = gerador(semente);
  const lista = [...ids];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

export function sortear<T>(candidatos: T[], quantidade: number, aleatorio: () => number = Math.random): T[] {
  const lista = [...candidatos];
  const n = Math.max(0, Math.min(quantidade, lista.length));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(aleatorio() * (lista.length - i));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.slice(0, n);
}

export type Situacao = "rascunho" | "agendado" | "aberto" | "encerrado";

export function situacaoSimulado(s: Pick<Simulado, "status" | "abre_em" | "fecha_em">, agora: Date): Situacao {
  if (s.status === "rascunho") return "rascunho";
  if (s.abre_em && agora.getTime() < Date.parse(s.abre_em)) return "agendado";
  if (s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em)) return "encerrado";
  return "aberto";
}
