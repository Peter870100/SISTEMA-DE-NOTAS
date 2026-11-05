import assert from "node:assert/strict";
import test from "node:test";
import type { Letra, SituacaoEstudo } from "../types";
import { exerciciosParaTela } from "./tela";

const SEGREDO = "COMENTARIO-SECRETO";
const alts = (["A", "B", "C", "D", "E"] as const).map((letra) => ({ letra, texto: `alt ${letra}` }));
// As linhas de entrada trazem gabarito e comentário de propósito: a saída não pode repetir.
const linha = (n: number, situacao: SituacaoEstudo = "publicado") =>
  ({ id: `e${n}`, ordem: n, enunciado: `Enunciado ${n}`, imagem_id: null, alternativas: alts, situacao, resposta_correta: "B" as Letra, comentario: SEGREDO });
const linhas = [linha(1), linha(2), linha(3, "retido"), linha(4, "rascunho")];
const gab = new Map([["e1", { resposta_correta: "B" as Letra, comentario: SEGREDO }], ["e2", { resposta_correta: "B" as Letra, comentario: SEGREDO }]]);

test("exercício não respondido não leva gabarito nem comentário, mesmo que a linha traga", () => {
  const saida = exerciciosParaTela(linhas, new Map([["e1", { marcada: "A" as Letra, acertou: false }]]), new Map([["e1", gab.get("e1")!]]), {});
  const e2 = saida.find((e) => e.id === "e2")!;
  assert.equal(e2.resposta, null);
  const nao = JSON.stringify(saida.filter((e) => e.id !== "e1"));
  assert.ok(!nao.includes("resposta_correta") && !nao.includes(SEGREDO));
  assert.ok(!JSON.stringify(e2).includes("certa"));
});

test("resposta vem preenchida só para o respondido", () => {
  const saida = exerciciosParaTela(linhas, new Map([["e1", { marcada: "A" as Letra, acertou: false }]]), gab, {});
  assert.deepEqual(saida.find((e) => e.id === "e1")!.resposta, { marcada: "A", acertou: false, certa: "B", comentario: SEGREDO });
  assert.equal(saida.find((e) => e.id === "e2")!.resposta, null);
  assert.ok(!JSON.stringify(saida).includes("resposta_correta"));
});

test("exercício fora de publicado não sai", () => {
  assert.deepEqual(exerciciosParaTela(linhas, new Map(), new Map(), {}).map((e) => e.id), ["e1", "e2"]);
});

test("sem conta, resposta é sempre null", () => {
  const saida = exerciciosParaTela(linhas, null, gab, {});
  assert.ok(saida.every((e) => e.resposta === null));
  assert.ok(!JSON.stringify(saida).includes(SEGREDO));
});

test("a figura vem do mapa de imagens", () => {
  const img = { id: "i1", src: "x", alt: "a", legenda: null, credito: null, licenca: null };
  const saida = exerciciosParaTela([{ ...linha(1), imagem_id: "i1" }, { ...linha(2), imagem_id: "sumiu" }], new Map(), new Map(), { i1: img });
  assert.equal(saida[0].imagem, img);
  assert.equal(saida[1].imagem, null);
});
