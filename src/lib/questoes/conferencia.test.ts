import { test } from "node:test";
import assert from "node:assert/strict";
import {
  justificarAlinhamento,
  estadoConferencia,
  camposFaltaImagem,
  camposConferida,
  paginaVizinha,
  quadroDoArraste,
  pixelsDoQuadro,
} from "./conferencia";

test("justificarAlinhamento", () => {
  assert.equal(justificarAlinhamento("esquerda"), "flex-start");
  assert.equal(justificarAlinhamento("centro"), "center");
  assert.equal(justificarAlinhamento("direita"), "flex-end");
});

test("estadoConferencia", () => {
  assert.equal(estadoConferencia({ falta_imagem: false, conferida_em: null }), "a_conferir");
  assert.equal(estadoConferencia({ falta_imagem: false, conferida_em: "2026-10-18T12:00:00.000Z" }), "conferida");
  assert.equal(estadoConferencia({ falta_imagem: true, conferida_em: null }), "falta_imagem");
  assert.equal(estadoConferencia({ falta_imagem: true, conferida_em: "2026-10-18T12:00:00.000Z" }), "falta_imagem");
});

test("camposFaltaImagem", () => {
  assert.deepEqual(camposFaltaImagem(), { status: "revisao", falta_imagem: true, conferida_em: null });
});

test("camposConferida", () => {
  const c = camposConferida(new Date("2026-10-18T12:00:00Z"));
  assert.equal(c.conferida_em, "2026-10-18T12:00:00.000Z");
  assert.equal(c.status, "publicada");
  assert.equal(c.falta_imagem, false);
  assert.equal(c.precisa_revisao, false);
});

test("paginaVizinha", () => {
  const ps = [{ id: "p3", numero: 3 }, { id: "p1", numero: 1 }, { id: "p2", numero: 2 }];
  assert.equal(paginaVizinha(ps, "p2", -1), "p1");
  assert.equal(paginaVizinha(ps, "p2", 1), "p3");
  assert.equal(paginaVizinha(ps, "p1", -1), null);
  assert.equal(paginaVizinha(ps, "p3", 1), null);
  assert.equal(paginaVizinha(ps, "px", 1), null);
});

test("quadroDoArraste", () => {
  assert.deepEqual(quadroDoArraste({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 }), { x: 0.2, y: 0.1, w: 0.3, h: 0.5 });
  assert.equal(quadroDoArraste({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.9 }), null);
});

test("pixelsDoQuadro", () => {
  assert.deepEqual(pixelsDoQuadro({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 1000, 800), { sx: 100, sy: 160, sw: 500, sh: 200 });
  const p = pixelsDoQuadro({ x: 0, y: 0, w: 0.0001, h: 0.0001 }, 100, 100);
  assert.equal(p.sw, 1);
  assert.equal(p.sh, 1);
});
