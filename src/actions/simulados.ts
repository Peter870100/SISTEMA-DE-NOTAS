"use server";

import { atorDaSessao } from "@/lib/simulados/ator";
import type { DadosSimulado } from "@/lib/simulados/configuracao";
import {
  adicionarQuestaoPor,
  buscarQuestoesBancoPor,
  criarSimuladoPor,
  liberarCorrecaoPor,
  publicarSimuladoPor,
  removerQuestaoPor,
  salvarSimuladoPor,
  sortearQuestoesPor,
  trocarQuestaoPor,
} from "@/lib/simulados/nucleo";
import type { FiltrosSorteio } from "@/lib/simulados/servidor";

// As regras ficam em src/lib/simulados/nucleo.ts (com ator explícito, as mesmas da Hermes); aqui só o ator da sessão.

export type { DadosSimulado };

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** Devolve o erro como texto: em produção o Next esconde a mensagem de erros lançados por actions. */
async function comErro<T>(f: () => Promise<T>, padrao: string): Promise<Resultado<T>> {
  try { return { ok: true, valor: await f() }; }
  catch (e) { return { ok: false, erro: e instanceof Error && e.message ? e.message : padrao }; }
}

export async function criarSimulado(d: DadosSimulado): Promise<Resultado<string>> {
  return comErro(async () => criarSimuladoPor(await atorDaSessao(), d), "Não foi possível criar o simulado.");
}

export async function salvarSimulado(id: string, d: DadosSimulado): Promise<Resultado<void>> {
  return comErro(async () => salvarSimuladoPor(await atorDaSessao(), id, d), "Não foi possível salvar o simulado.");
}

export async function sortearQuestoes(id: string, f: FiltrosSorteio & { quantidade: number; naoRepetir?: boolean }) {
  return comErro(async () => sortearQuestoesPor(await atorDaSessao(), id, f), "Não foi possível sortear.");
}
export async function trocarQuestao(id: string, questaoId: string, f: FiltrosSorteio & { naoRepetir?: boolean }) {
  return comErro(async () => trocarQuestaoPor(await atorDaSessao(), id, questaoId, f), "Não foi possível trocar a questão.");
}
export async function removerQuestao(id: string, questaoId: string) {
  return comErro(async () => removerQuestaoPor(await atorDaSessao(), id, questaoId), "Não foi possível remover a questão.");
}
export async function adicionarQuestao(id: string, questaoId: string) {
  return comErro(async () => adicionarQuestaoPor(await atorDaSessao(), id, questaoId), "Não foi possível adicionar a questão.");
}
export async function buscarQuestoesBanco(id: string, texto: string, f: FiltrosSorteio) {
  return comErro(async () => buscarQuestoesBancoPor(await atorDaSessao(), id, texto, f), "Não foi possível buscar.");
}
export async function publicarSimulado(id: string) {
  return comErro(async () => publicarSimuladoPor(await atorDaSessao(), id), "Não foi possível publicar.");
}

export async function liberarCorrecao(id: string): Promise<void> {
  await liberarCorrecaoPor(await atorDaSessao(), id);
}
