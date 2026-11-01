import test from "node:test";
import assert from "node:assert/strict";
import { pixelsDoRecorte } from "./recorte";

test("converte o quadro em pixels da página", () => {
  assert.deepEqual(pixelsDoRecorte({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 1000, 2000), { left: 100, top: 400, width: 500, height: 500 });
});

test("quadro que passa da borda é limitado", () => {
  const r = pixelsDoRecorte({ x: 0.9, y: 0.95, w: 0.2, h: 0.2 }, 1000, 2000);
  assert.ok(r.left + r.width <= 1000);
  assert.ok(r.top + r.height <= 2000);
  assert.ok(r.width >= 1 && r.height >= 1);
});

test("lados nunca ficam abaixo de 1 pixel", () => {
  const r = pixelsDoRecorte({ x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 }, 50, 50);
  assert.ok(r.width >= 1 && r.height >= 1);
});
