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
  casaFiltro,
  ordenarParaConferencia,
  proximaQuestao,
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

const q = (id: string, o: Partial<Parameters<typeof casaFiltro>[0]> = {}) => ({
  id, numero: Number(id), precisa_revisao: false, falta_imagem: false, conferida_em: null,
  resposta: "A" as const, anulada: false, status: "revisao" as const, ...o,
});

test("casaFiltro", () => {
  const conf = q("1", { conferida_em: "2026-01-01", status: "publicada" });
  const falta = q("2", { falta_imagem: true });
  assert.equal(casaFiltro(q("3"), "a-conferir"), true);
  assert.equal(casaFiltro(conf, "a-conferir"), false);
  assert.equal(casaFiltro(falta, "falta-imagem"), true);
  assert.equal(casaFiltro(conf, "conferidas"), true);
  assert.equal(casaFiltro(q("4", { precisa_revisao: true }), "aviso"), true);
  assert.equal(casaFiltro(q("5", { resposta: null }), "sem-resposta"), true);
  assert.equal(casaFiltro(q("6", { resposta: null, anulada: true }), "sem-resposta"), false);
  assert.equal(casaFiltro(conf, "aprovadas"), true);
  assert.equal(casaFiltro(falta, "aprovadas"), false);
  assert.equal(casaFiltro(falta, "todas"), true);
});

test("ordenarParaConferencia: com aviso primeiro, depois por numero", () => {
  const r = ordenarParaConferencia([q("3"), q("1"), q("2", { precisa_revisao: true })]);
  assert.deepEqual(r.map((x) => x.id), ["2", "1", "3"]);
});

test("proximaQuestao: segue a lista e ignora a atual", () => {
  const l = [q("1"), q("2"), q("3")];
  assert.equal(proximaQuestao(l, "1", "a-conferir")?.id, "2");
});

test("proximaQuestao: pula quem nao casa com o filtro e a atual ja conferida", () => {
  const l = [q("1"), q("2", { conferida_em: "x" }), q("3"), q("4")];
  assert.equal(proximaQuestao(l, "1", "a-conferir")?.id, "3");
  // atual (2) nao casa mais com a-conferir, mas a proxima vem depois dela
  assert.equal(proximaQuestao(l, "2", "a-conferir")?.id, "3");
});

test("proximaQuestao: filtros falta-imagem e conferidas continuam na lista", () => {
  const f = [q("1", { falta_imagem: true }), q("2"), q("3", { falta_imagem: true })];
  assert.equal(proximaQuestao(f, "1", "falta-imagem")?.id, "3");
  const c = [q("1", { conferida_em: "x" }), q("2", { conferida_em: "x" })];
  assert.equal(proximaQuestao(c, "1", "conferidas")?.id, "2");
});

test("proximaQuestao: volta ao comeco e devolve null sem outra", () => {
  const l = [q("1"), q("2"), q("3", { conferida_em: "x" })];
  assert.equal(proximaQuestao(l, "2", "a-conferir")?.id, "1");
  assert.equal(proximaQuestao([q("1")], "1", "a-conferir"), null);
  assert.equal(proximaQuestao([q("1"), q("2", { conferida_em: "x" })], "1", "a-conferir"), null);
  assert.equal(proximaQuestao(l, "9", "todas")?.id, "1");
});
