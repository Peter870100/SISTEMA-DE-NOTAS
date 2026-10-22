import assert from "node:assert/strict";
import test from "node:test";
import { filtrarRepetidas } from "./repetidas";

test("filtrarRepetidas tira as já aplicadas e conta quantas pulou", () => {
  assert.deepEqual(filtrarRepetidas(["a", "b", "c"], new Set(["b"])), { ids: ["a", "c"], puladas: 1 });
});

test("filtrarRepetidas com conjunto vazio não pula nada", () => {
  assert.deepEqual(filtrarRepetidas(["a", "b"], new Set()), { ids: ["a", "b"], puladas: 0 });
});

test("filtrarRepetidas com todas aplicadas devolve lista vazia", () => {
  assert.deepEqual(filtrarRepetidas(["a", "b"], new Set(["a", "b", "z"])), { ids: [], puladas: 2 });
});
