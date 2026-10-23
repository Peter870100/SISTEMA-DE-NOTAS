import type { Area, Letra, PorArea, Simulado, Tentativa } from "@/lib/types";

export const TOLERANCIA_SEG = 30;
export const PULSO_SEG = 15;
export const LACUNA_MAX_SEG = 20;
export const MAX_TREINO = 90;

export function prazoFinal(iniciadaEm: Date, duracaoMin: number | null, fechaEm: Date | null): Date | null {
  const porDuracao = duracaoMin ? new Date(iniciadaEm.getTime() + duracaoMin * 60_000) : null;
  if (porDuracao && fechaEm) return porDuracao < fechaEm ? porDuracao : fechaEm;
  return porDuracao ?? fechaEm ?? null;
}

/** Divide uma lista em pedaços (listas longas em `.in()` estouram o limite de URL). */
export function emBlocos<T>(lista: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho));
  return blocos;
}

export function aceitaResposta(agora: Date, prazoEm: Date | null): boolean {
  return !prazoEm || agora.getTime() <= prazoEm.getTime() + TOLERANCIA_SEG * 1000;
}

export const RECUSA_EM_ANDAMENTO = "O aluno está fazendo a prova agora; encerre antes.";

/**
 * Pode liberar nova tentativa? Recusa (mensagem) quando a tentativa está em andamento e o aluno ainda
 * pode estar respondendo: prazo no futuro (com a tolerância de sempre) ou sem prazo (treino). Só passa
 * com o pedido explícito `mesmoEmAndamento`. Entregue ou com prazo vencido → null (pode).
 */
export function regraNovaTentativa(t: { status: string; prazo_em: string | null }, agora: Date, mesmoEmAndamento: boolean): string | null {
  if (t.status !== "em_andamento" || mesmoEmAndamento) return null;
  return aceitaResposta(agora, t.prazo_em ? new Date(t.prazo_em) : null) ? RECUSA_EM_ANDAMENTO : null;
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
  return !!s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em) + TOLERANCIA_SEG * 1000;
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

/** Sorteio equilibrado entre grupos (matérias): um de cada grupo por rodada; grupo esgotado deixa a vaga para os outros. */
export function sortearEquilibrado<T>(grupos: T[][], quantidade: number, aleatorio: () => number = Math.random): T[] {
  const filas = sortear(grupos.filter((g) => g.length > 0), grupos.length, aleatorio).map((g) => sortear(g, g.length, aleatorio));
  const escolhidos: T[] = [];
  for (let rodada = 0; escolhidos.length < quantidade && filas.some((f) => f.length > rodada); rodada++) {
    for (const fila of filas) {
      if (escolhidos.length >= quantidade) break;
      if (rodada < fila.length) escolhidos.push(fila[rodada]);
    }
  }
  return sortear(escolhidos, escolhidos.length, aleatorio); // mistura a ordem das matérias no caderno
}

export type Situacao = "rascunho" | "agendado" | "aberto" | "encerrado";

export function situacaoSimulado(s: Pick<Simulado, "status" | "abre_em" | "fecha_em">, agora: Date): Situacao {
  if (s.status === "rascunho") return "rascunho";
  if (s.abre_em && agora.getTime() < Date.parse(s.abre_em)) return "agendado";
  if (s.fecha_em && agora.getTime() >= Date.parse(s.fecha_em)) return "encerrado";
  return "aberto";
}

/** Segundos como "m:ss" ou "h:mm:ss". */
export function formatarDuracao(seg: number): string {
  const t = Math.max(0, Math.floor(seg));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export type TemposQuestoes = Record<string, number>;
export const LIMITE_TEMPO_QUESTAO_SEG = 600 * 60;

/** Junta o tempo por questão salvo com o enviado pelo aparelho (valores acumulados: fica o maior). */
export function mesclarTempos(salvo: unknown, novo: unknown, ids: string[], limiteSeg: number): TemposQuestoes {
  const ler = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const a = ler(salvo), b = ler(novo);
  const r: TemposQuestoes = {};
  for (const id of ids) {
    const valores = [a[id], b[id]].filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0);
    if (valores.length) r[id] = Math.min(limiteSeg, Math.round(Math.max(...valores)));
  }
  return r;
}

/** Tempo total de uma tentativa entregue. Professor: relógio desde o início (até o prazo); treino: tempo ativo. */
export function tempoDeProvaSeg(
  tipo: "professor" | "treino",
  t: { iniciada_em: string; entregue_em: string | null; prazo_em: string | null; tempo_usado_seg: number },
): number | null {
  if (tipo === "treino") return t.tempo_usado_seg > 0 ? t.tempo_usado_seg : null;
  if (!t.entregue_em) return null;
  const fim = Math.min(Date.parse(t.entregue_em), t.prazo_em ? Date.parse(t.prazo_em) : Infinity);
  return Math.max(0, Math.round((fim - Date.parse(t.iniciada_em)) / 1000));
}

type TentResumo = Pick<Tentativa, "status" | "porcentagem" | "iniciada_em" | "entregue_em" | "prazo_em" | "tempo_usado_seg">;
type SimResumo = Pick<Simulado, "id" | "tipo" | "status" | "abre_em" | "fecha_em" | "correcao">;

/** Números do painel do aluno. Só notas já liberadas entram em concluídos/média (prova em sigilo fica de fora). */
export function resumoSimulados(daTurma: SimResumo[], treinos: SimResumo[], tentativas: Map<string, TentResumo>, agora: Date) {
  const todos = [...daTurma, ...treinos];
  const comNota = todos.filter((s) => tentativas.get(s.id)?.status === "entregue" && correcaoLiberada(s, agora));
  const notas = comNota.map((s) => tentativas.get(s.id)?.porcentagem).filter((p): p is number => p != null).map(Number);
  const tempoTotalSeg = todos.reduce((soma, s) => {
    const t = tentativas.get(s.id);
    return soma + (t?.status === "entregue" ? tempoDeProvaSeg(s.tipo, t) ?? 0 : 0);
  }, 0);
  const paraFazer = daTurma.filter((s) => {
    const t = tentativas.get(s.id);
    return t ? t.status === "em_andamento" : situacaoSimulado(s, agora) === "aberto";
  }).length;
  return { paraFazer, concluidos: comNota.length, media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null, tempoTotalSeg };
}
