import assert from "node:assert/strict";
import test from "node:test";
import { paginar, type BlocoMedido } from "./paginar";

const b = (altura: number, grudaNoProximo = false): BlocoMedido => ({ altura, grudaNoProximo });

test("enche a coluna 0 e depois a 1", () => {
  const r = paginar([b(40), b(40), b(40)], 100, 100);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].colunas, [[0, 1], [2]]);
});

test("passa para novas páginas", () => {
  const r = paginar([b(60), b(60), b(60), b(60), b(60)], 100, 100);
  assert.deepEqual(r.map((p) => p.colunas), [[[0], [1]], [[2], [3]], [[4], []]]);
});

test("primeira página usa alturaPrimeira", () => {
  const r = paginar([b(40), b(40), b(40)], 50, 100);
  assert.deepEqual(r.map((p) => p.colunas), [[[0], [1]], [[2], []]]);
});

test("título gruda no próximo bloco", () => {
  const r = paginar([b(50), b(30, true), b(40)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0], [1, 2]]);
});

test("cadeia faixa + título + próximo desce junta", () => {
  const r = paginar([b(70), b(10, true), b(10, true), b(40)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0], [1, 2, 3]]);
});

test("bloco maior que a coluna fica sozinho e é reduzido", () => {
  const r = paginar([b(250), b(20)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0], [1]]);
  assert.deepEqual(r[0].reduzir, { 0: 100 });
});

test("bloco alto não divide coluna com o anterior", () => {
  const r = paginar([b(20), b(250)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0], [1]]);
  assert.deepEqual(r[0].reduzir, { 1: 100 });
});

test("último bloco com grudaNoProximo é tratado como normal", () => {
  const r = paginar([b(40), b(30, true)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0, 1], []]);
});

test("cadeia maior que uma coluna vazia começa no topo de uma coluna vazia", () => {
  const r = paginar([b(10), b(60, true), b(60)], 100, 100);
  assert.deepEqual(r[0].colunas, [[0], [1]]);
  assert.deepEqual(r[1].colunas, [[2], []]);
});

test("lista vazia dá uma página vazia", () => {
  assert.deepEqual(paginar([], 100, 100), [{ colunas: [[], []], reduzir: {} }]);
});
