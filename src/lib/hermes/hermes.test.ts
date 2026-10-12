import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarPresenca, mesclarPresenca } from "./presenca";

test("mesclarPresenca: nunca diminui, limita e une eventos", () => {
  const a = mesclarPresenca({ saidas: 3, tempoForaSeg: 100, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: "2026-10-12T10:01:00Z" }] },
    { saidas: 2, tempoForaSeg: 150.6, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: null }, { questao: 5, saiu_em: "2026-10-12T10:05:00Z", voltou_em: null }] });
  assert.equal(a.saidas, 3);
  assert.equal(a.tempoForaSeg, 151);
  assert.equal(a.eventos.length, 2);
  assert.equal(mesclarPresenca(null, { saidas: -4, tempoForaSeg: 999999, eventos: "x" }).tempoForaSeg, 6 * 3600);
  assert.equal(mesclarPresenca(null, { saidas: -4 }).saidas, 0);
  const muitos = Array.from({ length: 250 }, (_, i) => ({ questao: 1, saiu_em: new Date(1e12 + i * 1000).toISOString(), voltou_em: null }));
  assert.equal(mesclarPresenca(null, { eventos: muitos }).eventos.length, 200);
});

test("formatarPresenca", () => {
  assert.equal(formatarPresenca(null, null), "—");
  assert.equal(formatarPresenca(0, 0), "nenhuma");
  assert.equal(formatarPresenca(1, 65), "1 saída · 1:05 fora");
  assert.equal(formatarPresenca(3, 160), "3 saídas · 2:40 fora");
});
