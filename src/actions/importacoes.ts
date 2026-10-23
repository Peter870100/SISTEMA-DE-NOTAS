"use server";

import { atorDaSessao } from "@/lib/simulados/ator";
import {
  aprovarSemAvisoPor,
  atualizarImportacaoPor,
  criarImportacaoPor,
  iniciarLeituraPor,
  lerDeNovoPor,
  prepararEnvioPaginaPor,
  registrarPaginaPor,
  type SituacaoImportacao as SituacaoDoNucleo,
} from "@/lib/questoes/importacao-nucleo";
import type { Escopo } from "@/lib/types";

// As regras ficam em src/lib/questoes/importacao-nucleo.ts (com ator explícito, as mesmas da Hermes); aqui só o ator da sessão.

export type SituacaoImportacao = SituacaoDoNucleo;

export async function criarImportacao(d: { escopo: Escopo; banca: string; ano: number | null; caderno: string }): Promise<string> {
  return criarImportacaoPor(await atorDaSessao(), d);
}

export async function prepararEnvioPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number) {
  return prepararEnvioPaginaPor(await atorDaSessao(), importacaoId, tipo, numero);
}

export async function registrarPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number, largura: number, altura: number) {
  return registrarPaginaPor(await atorDaSessao(), importacaoId, tipo, numero, largura, altura);
}

export async function iniciarLeitura(importacaoId: string): Promise<void> {
  return iniciarLeituraPor(await atorDaSessao(), importacaoId);
}

export async function atualizarImportacao(importacaoId: string): Promise<SituacaoImportacao> {
  return atualizarImportacaoPor(await atorDaSessao(), importacaoId);
}

export async function lerDeNovo(importacaoId: string): Promise<void> {
  return lerDeNovoPor(await atorDaSessao(), importacaoId);
}

export async function aprovarTodasSemAviso(importacaoId: string): Promise<number> {
  return aprovarSemAvisoPor(await atorDaSessao(), importacaoId);
}
