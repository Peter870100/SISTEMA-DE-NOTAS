import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataBR,
  escolherTroca,
  lerCabecalho,
  reordenar,
  removerDaOrdem,
  trechoEnunciado,
  validarCabecalho,
} from "./editar-prova";

test("validarCabecalho: trim, omite vazios e mantém quebras", () => {
  const r = validarCabecalho({ titulo: "  Simulado  ", turma: " 3º A ", data: "2026-11-05", valor: "", instrucoes: "  Use caneta.\nSem consulta.  " });
  assert.deepEqual(r, { ok: true, titulo: "Simulado", cabecalho: { turma: "3º A", data: "2026-11-05", instrucoes: "Use caneta.\nSem consulta." } });
});
test("validarCabecalho: recusa título vazio, longo, data inválida e limites", () => {
  assert.equal(validarCabecalho({ titulo: "   " }).ok, false);
  assert.equal(validarCabecalho({ titulo: "x".repeat(121) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "2026-02-30" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "05/11/2026" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", turma: "x".repeat(41) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", valor: "x".repeat(21) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", instrucoes: "x".repeat(601) }).ok, false);
  assert.deepEqual(validarCabecalho({ titulo: "T", instrucoes: "   \n  " }), { ok: true, titulo: "T", cabecalho: {} });
});
test("lerCabecalho: tolera lixo", () => {
  assert.deepEqual(lerCabecalho(null), {});
  assert.deepEqual(lerCabecalho({ turma: "3A", valor: 10, outra: "x" }), { turma: "3A" });
});
test("dataBR", () => assert.equal(dataBR("2026-11-05"), "05/11/2026"));
test("reordenar", () => {
  assert.deepEqual(reordenar(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(reordenar(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.equal(reordenar(["a", "b"], 0, 2), null);
  assert.equal(reordenar(["a", "b"], -1, 0), null);
  assert.equal(reordenar(["a", "b"], 1, 1), null);
});
test("removerDaOrdem", () => {
  assert.deepEqual(removerDaOrdem(["a", "b", "c"], 1), ["a", "c"]);
  assert.equal(removerDaOrdem(["a"], 0), null);
  assert.equal(removerDaOrdem(["a", "b"], 5), null);
});
test("escolherTroca: inédita primeiro, nunca uma da prova", () => {
  assert.deepEqual(escolherTroca(["a", "b", "c"], new Set(["a"]), new Set(["b"]), false, () => 0), { id: "c", usada: false });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), false), { id: null, haUsadas: true });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), true), { id: "b", usada: true });
  assert.deepEqual(escolherTroca(["a"], new Set(["a"]), new Set(), true), { id: null, haUsadas: false });
});
test("trechoEnunciado", () => {
  assert.equal(trechoEnunciado("**Leia** o  texto\n<b>abaixo</b>."), "Leia o texto abaixo.");
  assert.equal(trechoEnunciado("x".repeat(100), 90), "x".repeat(89) + "…");
});
