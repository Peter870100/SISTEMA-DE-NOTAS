import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_PADRAO, normalizarMedia, validarMediaDigitada } from "./media";

test("normalizarMedia usa o padrao para valores invalidos", () => {
  assert.equal(MEDIA_PADRAO, 6);
  assert.equal(normalizarMedia(undefined), 6);
  assert.equal(normalizarMedia("x"), 6);
  assert.equal(normalizarMedia(-1), 6);
  assert.equal(normalizarMedia(11), 6);
});

test("normalizarMedia arredonda a uma casa", () => {
  assert.equal(normalizarMedia(6.55), 6.6);
  assert.equal(normalizarMedia(7), 7);
  assert.equal(normalizarMedia("7.5"), 7.5);
  assert.equal(normalizarMedia(0), 0);
});

test("validarMediaDigitada aceita virgula e ponto", () => {
  assert.equal(validarMediaDigitada("6,5"), 6.5);
  assert.equal(validarMediaDigitada("6.5"), 6.5);
  assert.equal(validarMediaDigitada(" 6 "), 6);
  assert.equal(validarMediaDigitada("10"), 10);
});

test("validarMediaDigitada recusa fora da faixa e vazio", () => {
  assert.equal(validarMediaDigitada("10,1"), "A média precisa estar entre 0 e 10.");
  assert.equal(validarMediaDigitada("abc"), "A média precisa estar entre 0 e 10.");
  assert.equal(validarMediaDigitada(""), "Informe a média.");
});
