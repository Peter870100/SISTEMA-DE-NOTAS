import { test } from "node:test";
import assert from "node:assert/strict";
import { escalaDaTela, LARGURA_FOLHA_PX, passoZoom } from "./zoom";

test("escalaDaTela: auto cabe na tela estreita e fica em 100% na larga", () => {
  assert.equal(escalaDaTela("auto", 1280), 1);
  const estreita = escalaDaTela("auto", 400);
  assert.ok(Math.abs(estreita - (400 - 32) / LARGURA_FOLHA_PX) < 1e-9);
  assert.equal(escalaDaTela("auto", 50), 0.2);
});

test("escalaDaTela: ajustar usa a largura da janela (até 200%) e número é o %", () => {
  assert.ok(Math.abs(escalaDaTela("ajustar", 1280) - (1280 - 50) / LARGURA_FOLHA_PX) < 1e-9);
  assert.equal(escalaDaTela("ajustar", 5000), 2);
  assert.equal(escalaDaTela(150, 400), 1.5);
  assert.equal(escalaDaTela(10, 400), 0.5);
  assert.equal(escalaDaTela(900, 400), 2);
});

test("passoZoom: vai ao múltiplo de 10 seguinte, dentro de 50%–200%", () => {
  assert.equal(passoZoom(1, 1), 110);
  assert.equal(passoZoom(1, -1), 90);
  assert.equal(passoZoom(0.43, 1), 50);
  assert.equal(passoZoom(0.87, -1), 80);
  assert.equal(passoZoom(0.87, 1), 90);
  assert.equal(passoZoom(0.5, -1), 50);
  assert.equal(passoZoom(2, 1), 200);
});
