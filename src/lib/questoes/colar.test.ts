import { test } from "node:test";
import assert from "node:assert/strict";
import { colagemEhImagem } from "./colar";

test("só imagem vira imagem", () => {
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "", html: "" }), true);
});

test("imagem com texto simples é texto (Word/Excel)", () => {
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "Enunciado", html: "" }), false);
});

test("imagem com html que tem texto é texto", () => {
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "", html: "<html><body><p>Questão 1</p></body></html>" }), false);
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "  ", html: "<table><tr><td>3</td></tr></table>" }), false);
});

test("html que é só <img> continua imagem", () => {
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "", html: '<meta charset="utf-8"><!--StartFragment--><img src="x.png"><!--EndFragment-->' }), true);
  assert.equal(colagemEhImagem({ temArquivoImagem: true, texto: "", html: "<style>p{color:red}</style><img src=\"x\">&nbsp;" }), true);
});

test("sem arquivo de imagem nunca é imagem", () => {
  assert.equal(colagemEhImagem({ temArquivoImagem: false, texto: "", html: "<img src=\"x\">" }), false);
});
