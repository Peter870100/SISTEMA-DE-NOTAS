import assert from "node:assert/strict";
import test from "node:test";
import type { Segmento } from "@/lib/questoes/markdown";
import { dividirItem, dividirNos, dividirSegmentos, pontosDeCorte, tamanhoTexto } from "./dividir";

const s = (texto: string, negrito = false, italico = false): Segmento => ({ texto, negrito, italico });
const junta = (p: Segmento[]) => p.map((x) => x.texto).join("");

test("3 frases → 3 pedaços, negrito que atravessa a frase continua negrito", () => {
  const segs = [s("Primeira frase aqui. Segunda "), s("frase em negrito. Terceira", true), s(" frase no fim.")];
  const partes = dividirSegmentos(segs, 26);
  assert.equal(partes.length, 3);
  assert.deepEqual(partes.map(junta), ["Primeira frase aqui. ", "Segunda frase em negrito. ", "Terceira frase no fim."]);
  assert.deepEqual(partes[1], [s("Segunda "), s("frase em negrito. ", true)]);
  assert.deepEqual(partes[2], [s("Terceira", true), s(" frase no fim.")]);
  // nada se perde
  assert.equal(partes.map(junta).join(""), junta(segs));
});

test("frases curtas se juntam até o máximo", () => {
  const partes = dividirSegmentos([s("Um. Dois. Três. Quatro.")], 10);
  assert.deepEqual(partes.map(junta), ["Um. Dois. ", "Três. ", "Quatro."]);
});

test("uma frase longa só → pedaços por palavra de no máximo N caracteres", () => {
  const frase = "palavra ".repeat(20).trim();
  const partes = dividirSegmentos([s(frase, false, true)], 20);
  assert.ok(partes.length > 1);
  for (const p of partes) {
    assert.ok(junta(p).length <= 20, junta(p));
    assert.ok(p.every((x) => x.italico));
  }
  assert.equal(partes.map(junta).join(""), frase);
});

test("texto que cabe não é cortado; palavra maior que o máximo fica inteira", () => {
  assert.deepEqual(pontosDeCorte("curto.", 100), []);
  assert.deepEqual(pontosDeCorte("abcdefghij klm", 5), [11]);
});

test("nós do TipTap: marcas e quebra de linha mantidas", () => {
  const nos = [
    { type: "text", text: "Frase um. Frase ", marks: [{ type: "bold" as const }] },
    { type: "hardBreak" },
    { type: "text", text: "dois. Frase três.", marks: [{ type: "subscript" as const }] },
  ];
  const partes = dividirNos(nos, 13);
  assert.equal(partes.length, 3);
  assert.deepEqual(partes[0], [{ type: "text", text: "Frase um. ", marks: [{ type: "bold" }] }]);
  assert.deepEqual(partes[1].map((n) => n.type), ["text", "hardBreak", "text"]);
  assert.deepEqual(partes[1][2].marks, [{ type: "subscript" }]);
});

test("dividirItem: parágrafo vira pedaços com primeira/última; pedaço de pedaço herda", () => {
  const item = { tipo: "paragrafo" as const, segmentos: [s("Aaaa aaaa. Bbbb bbbb. Cccc cccc.")], indice: 0 };
  const r = dividirItem(item, 12)!;
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((b) => b.parte), [
    { primeira: true, ultima: false },
    { primeira: false, ultima: false },
    { primeira: false, ultima: true },
  ]);
  const meio = dividirItem({ ...item, segmentos: [s("Aaaa. Bbbb.")] }, 6, { primeira: false, ultima: false })!;
  assert.deepEqual(meio.map((b) => b.parte), [
    { primeira: false, ultima: false },
    { primeira: false, ultima: false },
  ]);
  assert.equal(dividirItem(item, 1000), null);
  assert.equal(tamanhoTexto(item), 32);
});

test("dividirItem: caixa vira um bloco por parágrafo; figura não se divide", () => {
  const p = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
  const caixa = { tipo: "noConteudo" as const, no: { type: "caixa", content: [p("um"), p("dois"), p("três")] }, primeiro: false };
  const r = dividirItem(caixa, 1)!;
  assert.equal(r.length, 3);
  assert.ok(r.every((b) => b.item.tipo === "noConteudo" && b.item.no.type === "caixa" && b.item.no.content?.length === 1));
  assert.deepEqual(r[0].parte, { primeira: true, ultima: false });
  assert.deepEqual(r[2].parte, { primeira: false, ultima: true });
  assert.equal(dividirItem({ tipo: "figura", figura: undefined, naAlternativa: false }, 1), null);
});
