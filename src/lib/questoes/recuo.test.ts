import { test } from "node:test";
import assert from "node:assert/strict";
import { RECUO_MAXIMO, mudarRecuo } from "./recuo";

test("aumenta e diminui um nível", () => {
  assert.equal(mudarRecuo(0, 1), 1);
  assert.equal(mudarRecuo(2, 1), 3);
  assert.equal(mudarRecuo(2, -1), 1);
});

test("fica entre 0 e 3", () => {
  assert.equal(RECUO_MAXIMO, 3);
  assert.equal(mudarRecuo(3, 1), 3);
  assert.equal(mudarRecuo(0, -1), 0);
});

test("valor estranho vira número válido", () => {
  assert.equal(mudarRecuo(undefined, 1), 1);
  assert.equal(mudarRecuo(null, -1), 0);
  assert.equal(mudarRecuo("2", 1), 1);
  assert.equal(mudarRecuo(Number.NaN, 1), 1);
  assert.equal(mudarRecuo(9, -1), 2);
  assert.equal(mudarRecuo(1.7, 1), 2);
  assert.equal(mudarRecuo(-4, 1), 1);
});
