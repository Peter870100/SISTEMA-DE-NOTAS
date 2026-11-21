import { test } from "node:test";
import assert from "node:assert/strict";
import { embaralhar } from "./embaralhar";

test("embaralhar preserva todos os exercícios sem modificar a lista original", () => {
  const original = ["a", "b", "c", "d"];
  const resultado = embaralhar(original, () => 0);
  assert.deepEqual(resultado, ["b", "c", "d", "a"]);
  assert.deepEqual(original, ["a", "b", "c", "d"]);
  assert.deepEqual(embaralhar([], () => 0), []);
});
