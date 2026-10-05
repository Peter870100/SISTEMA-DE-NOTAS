import { test } from "node:test";
import assert from "node:assert/strict";
import { mesmaEscola, podeAcessarTurma } from "./escola-regras";

const P = { escola_id: "e1" };

test("podeAcessarTurma: escola diferente nunca", () => {
  assert.equal(podeAcessarTurma(P, { escola_id: "e2", nome: "1A" }, null), false);
  assert.equal(podeAcessarTurma(P, { escola_id: "e2", nome: "1A" }, new Set(["1A"])), false);
});

test("podeAcessarTurma: mesma escola respeita acesso restrito", () => {
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, null), true);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, new Set(["1A"])), true);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "2B" }, new Set(["1A"])), false);
  assert.equal(podeAcessarTurma(P, { escola_id: "e1", nome: "1A" }, new Set()), false);
});

test("mesmaEscola", () => {
  assert.equal(mesmaEscola({ escola_id: "e1" }, "e1"), true);
  assert.equal(mesmaEscola({ escola_id: "e2" }, "e1"), false);
  assert.equal(mesmaEscola({ escola_id: null }, "e1"), false);
});
