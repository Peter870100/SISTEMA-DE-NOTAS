/** Funções puras de apresentação do relatório do aluno (cores, textos, dados dos gráficos). */
import type { BimestreAluno, LinhaSimuladoAluno, ResultadoQuantoFalta, SituacaoSimulado } from "./tipos";
import { formatarNecessaria, formatarNota } from "./calculos";

export type TomQuantoFalta = "ok" | "gold" | "danger" | "brand";

export function tomQuantoFalta(s: ResultadoQuantoFalta["situacao"]): TomQuantoFalta {
  switch (s) {
    case "atingiu": return "ok";
    case "precisa": return "gold";
    case "impossivel":
    case "nao_atingiu": return "danger";
    default: return "brand";
  }
}

export function cartaoQuantoFalta(q: ResultadoQuantoFalta, media: number): { titulo: string; destaque: string | null; texto: string } {
  const m = formatarNota(media);
  switch (q.situacao) {
    case "atingiu":
      return { titulo: "Já atingiu a média", destaque: null, texto: `A média dos bimestres encerrados já está em ${m} ou mais.` };
    case "precisa":
      return q.porBimestre === undefined
        ? { titulo: "Quanto falta", destaque: null, texto: "Sem dados suficientes." }
        : { titulo: "Precisa tirar, em cada bimestre restante", destaque: formatarNecessaria(q.porBimestre), texto: `Para fechar o ano com média ${m}.` };
    case "impossivel":
      return {
        titulo: "Não há como chegar à média",
        destaque: q.porBimestre === undefined ? null : formatarNecessaria(q.porBimestre),
        texto: q.porBimestre === undefined
          ? `Mesmo com 10 nos bimestres restantes, não chega a ${m}.`
          : `Precisaria de ${formatarNecessaria(q.porBimestre)} em cada bimestre restante, e o máximo é 10,0.`,
      };
    case "nao_atingiu":
      return { titulo: "Não atingiu a média", destaque: null, texto: `Os 4 bimestres estão encerrados e a média final ficou abaixo de ${m}.` };
    default:
      return { titulo: "Sem dados ainda", destaque: null, texto: "Nenhum bimestre foi encerrado, então ainda não dá para calcular." };
  }
}

export const ROTULO_SITUACAO: Record<SituacaoSimulado, string> = {
  fez: "Fez",
  fazendo: "Fazendo agora",
  nao_entregou: "Não entregou",
  nao_fez: "Não fez",
  sem_login: "Sem login",
};

export function formatarDuracao(seg: number | null): string {
  if (seg === null || !Number.isFinite(seg) || seg < 0) return "—";
  if (seg < 60) return `${Math.round(seg)} s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export function formatarDataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Campo_Grande" });
}

export type PontoBimestre = { nome: string; media: number | null; andamento: boolean };

export function pontosBimestres(b: BimestreAluno[]): PontoBimestre[] {
  return b.map((x) => ({ nome: x.bimestre, media: x.media === null ? null : Number(x.media.toFixed(1)), andamento: x.vigente && !x.encerrado }));
}

export type PontoSimulado = { nome: string; data: string; nota: number };

/** Só simulados feitos, na ordem recebida (o carregador já entrega em ordem de abertura). */
export function pontosSimulados(l: LinhaSimuladoAluno[]): PontoSimulado[] {
  return l
    .filter((x) => x.situacao === "fez" && x.nota10 !== null)
    .map((x) => ({ nome: x.titulo, data: formatarDataCurta(x.abreEm), nota: Number((x.nota10 as number).toFixed(1)) }));
}
