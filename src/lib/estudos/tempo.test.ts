import test from "node:test";
import assert from "node:assert/strict";
import { minutosDoEstudo } from "./tempo";

test("minutosDoEstudo arredonda de 5 em 5", () => {
  assert.equal(minutosDoEstudo(600, 10), 25); // 4 + 20 = 24
  assert.equal(minutosDoEstudo(0, 0), 5);
  assert.equal(minutosDoEstudo(150, 2), 5);
  assert.equal(minutosDoEstudo(0, 1), 5); // 2 brutos
  assert.equal(minutosDoEstudo(150, 10), 25); // 21 brutos: arredonda para cima
});
