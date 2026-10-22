import { AREAS } from "@/lib/questoes/materias";
import type { Area, Simulado } from "@/lib/types";
import type { FiltrosSorteio } from "./servidor";

/** Regras puras de configuração de simulado: as mesmas para a tela e para a Hermes. */

export type TurmaSimulado = { turma_nome: string; ano_letivo: string };

export type DadosSimulado = {
  titulo: string;
  turmas: TurmaSimulado[];
  duracaoMin: number;
  abreEm: string;
  fechaEm: string;
  correcao: "na_hora" | "apos_prazo";
  embaralhar: boolean;
};

export type ConfiguracaoLimpa = {
  titulo: string;
  duracao_min: number;
  abre_em: string;
  fecha_em: string;
  correcao: "na_hora" | "apos_prazo";
  embaralhar: boolean;
};

export const chaveTurma = (t: TurmaSimulado) => `${t.turma_nome}|${t.ano_letivo}`;

/** Entradas externas não são confiáveis: normaliza os filtros uma única vez. */
export function limparFiltros(f: FiltrosSorteio): FiltrosSorteio {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const ano = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const area = texto(f?.area);
  if (area && !Object.prototype.hasOwnProperty.call(AREAS, area)) throw new Error("Área inválida.");
  return {
    area: area as Area | undefined,
    materia: texto(f?.materia),
    assunto_id: texto(f?.assunto_id),
    banca: texto(f?.banca),
    anoDe: ano(f?.anoDe),
    anoAte: ano(f?.anoAte),
  };
}

export function limparConfiguracao(d: DadosSimulado): ConfiguracaoLimpa {
  const titulo = d.titulo.trim();
  if (!titulo) throw new Error("Informe o título.");
  const duracao = Math.round(d.duracaoMin);
  if (!Number.isFinite(duracao) || duracao < 1 || duracao > 600) throw new Error("Duração de 1 a 600 minutos.");
  const abre = Date.parse(d.abreEm), fecha = Date.parse(d.fechaEm);
  if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) throw new Error("A data de fechamento precisa ser depois da abertura.");
  if (d.correcao !== "na_hora" && d.correcao !== "apos_prazo") throw new Error("Escolha quando sai a correção.");
  return { titulo: titulo.slice(0, 160), duracao_min: duracao, abre_em: new Date(abre).toISOString(), fecha_em: new Date(fecha).toISOString(), correcao: d.correcao, embaralhar: Boolean(d.embaralhar) };
}

/** Com alunos já fazendo a prova, só pode mudar título, correção, fechamento e acrescentar turmas. */
export function mudancaProibidaComTentativas(
  antes: Pick<Simulado, "duracao_min" | "embaralhar" | "abre_em">,
  depois: Pick<ConfiguracaoLimpa, "duracao_min" | "embaralhar" | "abre_em">,
  turmasAntes: TurmaSimulado[],
  turmasDepois: TurmaSimulado[],
): boolean {
  const novas = new Set(turmasDepois.map(chaveTurma));
  return depois.duracao_min !== antes.duracao_min
    || depois.embaralhar !== Boolean(antes.embaralhar)
    || Date.parse(depois.abre_em) !== Date.parse(antes.abre_em ?? "")
    || turmasAntes.some((t) => !novas.has(chaveTurma(t)));
}

export function validarPublicacao(s: Pick<Simulado, "abre_em" | "fecha_em">, qtdQuestoes: number, qtdTurmas: number): string | null {
  if (qtdQuestoes === 0) return "Adicione questões antes de publicar.";
  if (qtdTurmas === 0) return "Escolha ao menos uma turma.";
  if (!s.abre_em || !s.fecha_em) return "Defina abertura e fechamento.";
  return null;
}

/** A nova ordem é uma permutação das questões atuais (sem faltar, sobrar nem repetir). */
export function validarOrdem(atual: string[], nova: string[]): string | null {
  const erro = "A nova ordem precisa ter exatamente as mesmas questões.";
  if (!Array.isArray(nova) || nova.length !== atual.length) return erro;
  const ids = new Set(atual);
  if (new Set(nova).size !== nova.length || nova.some((q) => !ids.has(q))) return erro;
  return null;
}
