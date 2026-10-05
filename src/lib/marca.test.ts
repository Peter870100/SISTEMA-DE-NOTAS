import { test } from "node:test";
import assert from "node:assert/strict";
import { hexParaRgb, razaoContraste, textoSobre, validarCores, variaveisDaMarca, marcaDaEscola, MARCA_PADRAO } from "./marca";

test("hexParaRgb", () => {
  assert.deepEqual(hexParaRgb("#0a2a6e"), [10, 42, 110]);
  assert.deepEqual(hexParaRgb("#FFF"), [255, 255, 255]);
  assert.equal(hexParaRgb("0a2a6e"), null);
  assert.equal(hexParaRgb("#12345"), null);
  assert.equal(hexParaRgb("#gggggg"), null);
});

test("razaoContraste e textoSobre", () => {
  assert.equal(Math.round(razaoContraste("#000000", "#ffffff")), 21);
  assert.equal(razaoContraste("#777777", "#777777"), 1);
  assert.equal(textoSobre("#0a2a6e"), "#ffffff");
  assert.equal(textoSobre("#f5d90a"), "#0e1b3d");
});

test("variaveisDaMarca: nulas não mexem no tema", () => {
  assert.deepEqual(variaveisDaMarca(null, null), {});
  const v = variaveisDaMarca("#0b5d3b", "#ffb703");
  assert.equal(v["--color-frame"], "#0b5d3b");
  assert.equal(v["--color-brand"], "#0b5d3b");
  assert.equal(v["--color-gold"], "#ffb703");
  assert.equal(v["--color-gold-ink"], "#0e1b3d");
  for (const k of ["--color-frame-deep", "--color-frame-line", "--color-frame-muted", "--color-brand-bright"]) assert.match(v[k], /^#[0-9a-f]{6}$/);
  assert.deepEqual(Object.keys(variaveisDaMarca(null, "#ffb703")).sort(), ["--color-gold", "--color-gold-ink"]);
  assert.deepEqual(variaveisDaMarca("xyz", null), {});
});

test("validarCores", () => {
  assert.deepEqual(validarCores(null, null), { erro: null, alertas: [] });
  assert.equal(validarCores("#0b5d3b", "#ffb703").erro, null);
  assert.notEqual(validarCores("#f1f1f1", null).erro, null); // texto branco ilegível
  assert.notEqual(validarCores("verde", null).erro, null);
  assert.notEqual(validarCores(null, "#12").erro, null);
  assert.equal(validarCores("#0b5d3b", "#0d6b45").alertas.length, 1); // destaque quase igual à moldura
});

test("marcaDaEscola", () => {
  assert.equal(marcaDaEscola({ id: "00000000-0000-0000-0000-000000000001", nome: "Colégio Status", logo_url: "/l.png", slogan: null, foto_login_url: null }).padrao, true);
  const x = marcaDaEscola({ id: "x", nome: "Escola X", logo_url: "", slogan: "Oi", foto_login_url: null });
  assert.equal(x.padrao, false);
  assert.equal(x.slogan, "Oi");
  assert.equal(MARCA_PADRAO.padrao, true);
});
