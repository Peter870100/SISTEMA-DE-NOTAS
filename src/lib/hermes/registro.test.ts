import { test } from "node:test";
import assert from "node:assert/strict";
import { resumirParametros } from "./registro";

test("string longa e cortada em 200 caracteres", () => {
  assert.equal(resumirParametros("a".repeat(500)), "a".repeat(200) + "…");
  assert.equal(resumirParametros("curta"), "curta");
});

test("lista de 50 vira 20 itens mais o resumo", () => {
  const r = resumirParametros(Array.from({ length: 50 }, (_, i) => i)) as unknown[];
  assert.equal(r.length, 21);
  assert.equal(r[19], 19);
  assert.equal(r[20], "… e mais 30");
});

test("chaves sensiveis viram ***", () => {
  const r = resumirParametros({ senha: "x", token: "y", professor_telefone: "6799", ok: 1 }) as Record<string, unknown>;
  assert.equal(r.senha, "***");
  assert.equal(r.token, "***");
  assert.equal(r.professor_telefone, "***");
  assert.equal(r.ok, 1);
});

test("profundidade maior que 3 vira reticencias", () => {
  const r = resumirParametros({ a: { b: { c: { d: 1 } } } }) as { a: { b: { c: unknown } } };
  assert.equal(r.a.b.c, "…");
});
