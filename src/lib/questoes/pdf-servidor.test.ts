import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { abrirPdfServidor, escalaPagina } from "./pdf-servidor";

const fixture = (nome: string) => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", nome)));

test("escalaPagina: 150 dpi em página A4", () => {
  assert.equal(escalaPagina(595), 150 / 72);
});

test("escalaPagina: página larga é limitada a 1600 px", () => {
  assert.equal(escalaPagina(2000), 0.8);
});

test("abre o fixture e desenha a página 1 em JPEG", async () => {
  const pdf = await abrirPdfServidor(fixture("prova-2-paginas.pdf"));
  try {
    assert.equal(pdf.numPaginas, 2);
    const { jpeg, largura, altura } = await pdf.desenhar(1);
    assert.equal(jpeg[0], 0xff);
    assert.equal(jpeg[1], 0xd8);
    assert.ok(largura <= 1600);
    assert.ok(altura > largura);
    assert.equal(largura, Math.round(595 * (150 / 72)));
  } finally {
    await pdf.fechar();
  }
});

test("arquivo inválido", async () => {
  await assert.rejects(abrirPdfServidor(new TextEncoder().encode("%PDF-lixo")), { message: "Não consegui abrir o PDF." });
});

test("PDF protegido por senha", async () => {
  await assert.rejects(abrirPdfServidor(fixture("prova-com-senha.pdf")), { message: "O PDF está protegido por senha." });
});
