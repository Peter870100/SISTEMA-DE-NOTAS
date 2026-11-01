import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cenarioIneditas,
  codigoLink,
  escolherQuestoes,
  tituloProva,
  verificarCodigoLink,
} from "./provas-word";

test("tituloProva", () => {
  assert.equal(tituloProva("fixacao", "Biologia"), "Atividade de Fixação – Biologia");
  assert.equal(tituloProva("simulado", "Biologia", "Genética"), "Simulado – Biologia · Genética");
});

test("cenarioIneditas", () => {
  const c = cenarioIneditas(["a", "b", "c", "d"], new Set(["b", "x"]), 3);
  assert.deepEqual(c, { elegiveis: 4, usadas: 1, ineditas: 3, pedidas: 3, cabeEmIneditas: true });
  assert.equal(cenarioIneditas(["a", "b"], new Set(["a"]), 2).cabeEmIneditas, false);
});

test("escolherQuestoes: só inéditas por padrão, sem completar", () => {
  const r = escolherQuestoes(["a", "b", "c"], new Set(["a"]), 3, false, () => 0);
  assert.equal(r.ids.length, 2);
  assert.equal(r.repetidas, 0);
  assert.ok(!r.ids.includes("a"));
});

test("escolherQuestoes: com repetidas completa depois das inéditas", () => {
  const r = escolherQuestoes(["a", "b", "c"], new Set(["a"]), 3, true, () => 0);
  assert.equal(r.ids.length, 3);
  assert.equal(r.repetidas, 1);
  assert.equal(r.ids.at(-1), "a");
});

test("escolherQuestoes: nunca passa do que existe nem repete id", () => {
  const r = escolherQuestoes(["a", "b"], new Set(), 10, true);
  assert.equal(new Set(r.ids).size, 2);
});

test("codigoLink: confere e recusa adulterado/outra prova", () => {
  const c = codigoLink("p1", "k");
  assert.equal(verificarCodigoLink("p1", c, "k"), true);
  assert.equal(verificarCodigoLink("p2", c, "k"), false);
  assert.equal(verificarCodigoLink("p1", c.slice(0, -1) + (c.endsWith("0") ? "1" : "0"), "k"), false);
  assert.equal(verificarCodigoLink("p1", null, "k"), false);
});
