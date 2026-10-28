import { MAX_GERANDO_MS } from "@/lib/questoes/geracao";
import type { Dificuldade } from "@/lib/types";
import { materiaDoTexto } from "../leitura/banco";
import type { Perfil } from "./ator";

/**
 * Partes puras das ferramentas gerar_questoes e situacao_geracao da Hermes (sem rede, sem banco):
 * conferência do pedido, filtros de repetição e textos de resposta.
 */

/** Mesma mensagem da tela para geração de outra escola: não confirma que o id existe. */
export const ERRO_GERACAO = "Geração não encontrada.";
export const ERRO_BANCO_ESCOLA_GERACAO = "Você só pode gerar no banco da sua escola.";
export const MSG_PAROU = "A geração parou no meio. Tente de novo.";
/** Janela em que um gerar_questoes repetido acha a geração anterior ainda em andamento. */
export const JANELA_REPETIDA_MS = 15 * 60 * 1000;

export type ArgsGerar = {
  materia?: string; assunto?: string; dificuldade: Dificuldade; quantidade: number;
  orientacao?: string; questao_modelo_id?: string; banco?: "escola" | "geral";
};
export type PedidoHermes = {
  materia: string | null; assunto: string | null; dificuldade: Dificuldade; quantidade: number;
  orientacao: string; modeloId: string | null; escopo: "escola" | "geral";
};

/** Confere os parâmetros de gerar_questoes (sem rede). Professor só no banco da escola. Pura. */
export function lerPedidoGeracao(args: ArgsGerar, perfil: Perfil): PedidoHermes {
  const escopo = args.banco ?? "escola";
  if (escopo === "geral" && perfil === "professor") throw new Error(ERRO_BANCO_ESCOLA_GERACAO);
  const materiaTexto = (args.materia ?? "").trim();
  const modeloId = (args.questao_modelo_id ?? "").trim() || null;
  if (!materiaTexto && !modeloId) throw new Error("Diga a matéria (ou a questão modelo).");
  return {
    materia: materiaTexto ? materiaDoTexto(materiaTexto) : null,
    assunto: (args.assunto ?? "").trim() || null,
    dificuldade: args.dificuldade,
    quantidade: args.quantidade,
    orientacao: (args.orientacao ?? "").trim(),
    modeloId,
    escopo,
  };
}

/** Filtros para achar uma geração igual ainda "gerando", pedida há pouco. Pura. */
export function criteriosGeracaoRepetida(
  p: { materia: string; assunto_id: string | null; dificuldade: Dificuldade; quantidade: number; orientacao: string; escopo: "escola" | "geral"; base_id: string | null },
  escolaId: string, professorId: string, agora: number,
) {
  return {
    escola_id: escolaId,
    professor_id: professorId,
    status: "gerando" as const,
    materia: p.materia,
    assunto_id: p.assunto_id,
    dificuldade: p.dificuldade,
    quantidade_pedida: p.quantidade,
    orientacao: p.orientacao,
    questao_base_id: p.base_id,
    escopo: p.escopo,
    desde: new Date(agora - JANELA_REPETIDA_MS).toISOString(),
  };
}

/** Geração "gerando" há mais que o limite: a função parou no meio. Data inválida conta como parada. Pura. */
export function gerandoParou(createdAt: string, agora: number): boolean {
  const criada = Date.parse(createdAt);
  if (Number.isNaN(criada)) return true;
  return agora - criada > MAX_GERANDO_MS;
}

const dinheiro = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Resposta de gerar_questoes. `restante` = quantas ainda cabem na cota de hoje (null = sem limite). Pura. */
export function textoGeracaoIniciada(d: { id: string; rotulo: string; quantidade: number; restante: number | null }): string {
  return [
    `Geração ${d.id} começou (${d.rotulo}): ${plural(d.quantidade, "questão", "questões")}.`,
    d.restante !== null ? `Ainda cabem ${d.restante} na cota de hoje da escola.` : null,
    `A IA leva de 1 a 3 minutos: chame situacao_geracao com geracao_id ${d.id} para ver o resultado.`,
  ].filter(Boolean).join(" ");
}

export type LinhaGerada = { id: string; enunciado: string; resposta: string | null; status: string };

const comeco = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > 120 ? `${s.slice(0, 120).trimEnd()}…` : s;
};

/** Resposta de situacao_geracao. Pura. */
export function textoSituacaoGeracao(d: {
  id: string; status: "gerando" | "concluida" | "erro"; minutos?: number; erro?: string | null;
  questoes?: LinhaGerada[]; descartadas?: number; custo?: number | null; link?: string;
}): string {
  if (d.status === "gerando") {
    const quando = d.minutos !== undefined ? ` (há ${plural(d.minutos, "minuto", "minutos")})` : "";
    return `Ainda gerando${quando}. Chame situacao_geracao de novo com geracao_id ${d.id} em instantes.`;
  }
  if (d.status === "erro") {
    const msg = (d.erro ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim() || "A geração terminou com erro.";
    return `A geração ${d.id} terminou com erro: ${msg}`;
  }
  const qs = d.questoes ?? [];
  if (qs.length === 0) {
    return `A geração ${d.id} foi concluída, mas nenhuma das questões está mais no banco.${d.link ? ` Banco: ${d.link}` : ""}`;
  }
  const linhas = qs.map((q, i) => `${i + 1}) ${comeco(q.enunciado)} ${q.resposta ? `(${q.resposta})` : "(sem resposta)"} — id ${q.id}`);
  const partes = [`Geração ${d.id} concluída: ${plural(qs.length, "questão gerada", "questões geradas")}, em revisão.`, ...linhas];
  if (d.descartadas && d.descartadas > 0) partes.push(`${plural(d.descartadas, "questão descartada", "questões descartadas")} por problema.`);
  if (d.custo !== null && d.custo !== undefined) partes.push(`Custo: ${dinheiro(d.custo)}.`);
  if (d.link) partes.push(`Revisar: ${d.link}`);
  return partes.join("\n");
}

/** Item `numero` (1..N) de uma lista; fora disso, mensagem para a Hermes pedir outro número. Pura. */
export function escolherNumero<T>(lista: T[], numero: number): T {
  if (!Number.isInteger(numero) || numero < 1 || numero > lista.length) {
    throw new Error(`Essa geração tem ${plural(lista.length, "questão", "questões")}; peça um número de 1 a ${lista.length}.`);
  }
  return lista[numero - 1];
}

const ROTULO_STATUS_QUESTAO: Record<string, string> = { revisao: "Em revisão", publicada: "Publicada" };

/** Questão inteira para a Hermes mostrar (enunciado, alternativas, resposta, resolução). Pura. */
export function textoQuestaoCompleta(q: {
  id: string; enunciado: string; comando: string; alternativas: { letra: string; texto: string }[];
  resposta: string | null; resolucao: string | null; status: string;
}, numero: number): string {
  const partes = [
    `Questão ${numero} (id ${q.id}) — ${ROTULO_STATUS_QUESTAO[q.status] ?? q.status}`,
    q.enunciado.trim(),
    q.comando.trim(),
    ...q.alternativas.map((a) => `${a.letra}) ${a.texto}`),
    `Resposta: ${q.resposta ?? "(sem resposta)"}`,
  ];
  if (q.resolucao?.trim()) partes.push(`Resolução: ${q.resolucao.trim()}`);
  return partes.filter(Boolean).join("\n");
}
