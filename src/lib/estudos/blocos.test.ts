import test from "node:test";
import assert from "node:assert/strict";
import { contarPalavras, imagensCitadas, blocosVisiveis, trocarImagens, validarBlocos } from "./blocos";

const ok = [{ tipo: "titulo", texto: "O que é" }, { tipo: "paragrafo", texto: "Razão é uma divisão." }];
test("aceita blocos válidos", () => assert.equal(validarBlocos(ok, new Set()).ok, true));
test("recusa tipo desconhecido", () => assert.equal(validarBlocos([{ tipo: "video", url: "x" }], new Set()).ok, false));
test("recusa acima de 800 palavras", () => {
  const r = validarBlocos([{ tipo: "paragrafo", texto: "a ".repeat(801) }], new Set());
  assert.deepEqual(r, { ok: false, erro: "O texto tem 801 palavras; o limite é 800." });
});
test("recusa imagem que não é do material", () => {
  assert.equal(validarBlocos([{ tipo: "imagem", imagem_id: "x" }], new Set(["y"])).ok, false);
  assert.equal(validarBlocos([{ tipo: "trecho", texto: "a", autor: "b", imagem_id: "x" }], new Set()).ok, false);
});
test("trocarImagens troca chave por id no bloco imagem e no trecho", () => {
  const b = trocarImagens([{ tipo: "imagem", imagem_id: "foto1" }], { foto1: "uuid" });
  assert.deepEqual(imagensCitadas(b), ["uuid"]);
});
test("blocosVisiveis tira a imagem sem aprovação e deixa o trecho sem foto", () => {
  const v = blocosVisiveis([{ tipo: "imagem", imagem_id: "x" }, { tipo: "trecho", texto: "a", autor: "b", imagem_id: "x" }], new Set());
  assert.deepEqual(v, [{ tipo: "trecho", texto: "a", autor: "b" }]);
});
test("contarPalavras soma textos de todos os tipos", () => {
  assert.equal(contarPalavras([{ tipo: "pegadinhas", itens: [{ titulo: "Um dois", texto: "três" }] }, { tipo: "lista", itens: ["quatro"] }]), 4);
});
