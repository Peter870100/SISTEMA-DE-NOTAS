import { test } from "node:test";
import assert from "node:assert/strict";
import { MATERIAS, areaDaMateria, ehMateria, LETRAS } from "./materias";
import { ASSUNTOS_INICIAIS } from "./assuntos-iniciais";
import { estiloRecorte, limitarQuadro } from "./quadro";
import { markdownParaBlocos } from "./markdown";

test("matérias e áreas", () => {
  assert.equal(Object.keys(MATERIAS).length, 14);
  assert.equal(areaDaMateria("fisica"), "natureza");
  assert.equal(areaDaMateria("filosofia"), "humanas");
  assert.equal(areaDaMateria("ingles"), "linguagens");
  assert.equal(ehMateria("fisica"), true);
  assert.equal(ehMateria("astrologia"), false);
  assert.deepEqual([...LETRAS], ["A", "B", "C", "D", "E"]);
  for (const m of Object.keys(MATERIAS)) assert.ok((ASSUNTOS_INICIAIS as Record<string, string[]>)[m].length >= 5, m);
});

test("limitarQuadro mantém o quadro dentro da página", () => {
  assert.deepEqual(limitarQuadro({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(limitarQuadro({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 }), { x: 0, y: 0.9, w: 0.5, h: 0.1 });
  const q = limitarQuadro({ x: 0.995, y: 0, w: 0.5, h: 0.001 });
  assert.ok(q.w >= 0.01 && q.h >= 0.01 && q.x + q.w <= 1 && q.y + q.h <= 1);
  const nan = limitarQuadro({ x: Number.NaN, y: 0, w: 0.2, h: 0.2 });
  assert.equal(nan.x, 0);
});

test("estiloRecorte calcula fundo e proporção", () => {
  const e = estiloRecorte({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1000, 2000);
  assert.equal(e.backgroundSize, "200% auto");
  assert.equal(e.backgroundPosition, "50% 66.6667%");
  assert.equal(e.aspectRatio, "500 / 500");
  const inteiro = estiloRecorte({ x: 0, y: 0, w: 1, h: 1 }, 800, 1200);
  assert.equal(inteiro.backgroundPosition, "0% 0%");
});

test("markdown seguro: negrito, itálico, linhas, HTML vira texto", () => {
  assert.deepEqual(markdownParaBlocos("Olá **mundo** e *você*"), [[
    { texto: "Olá ", negrito: false, italico: false },
    { texto: "mundo", negrito: true, italico: false },
    { texto: " e ", negrito: false, italico: false },
    { texto: "você", negrito: false, italico: true },
  ]]);
  assert.equal(markdownParaBlocos("linha 1\nlinha 2").length, 2);
  assert.deepEqual(markdownParaBlocos("<script>x</script>"), [[{ texto: "<script>x</script>", negrito: false, italico: false }]]);
  assert.deepEqual(markdownParaBlocos(""), []);
  assert.deepEqual(markdownParaBlocos("a **sem fechar"), [[{ texto: "a **sem fechar", negrito: false, italico: false }]]);
});
