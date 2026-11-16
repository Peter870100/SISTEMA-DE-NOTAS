import { test } from "node:test";
import assert from "node:assert/strict";
import { pendentesRefazer, ehRefazer } from "./refazer";

test("pendentes: tira refeitas e não mostráveis, mais recente primeiro", () => {
  const erradas = [
    { questaoId: "q1", erradaEm: "2026-10-01T10:00:00.000Z" },
    { questaoId: "q2", erradaEm: "2026-10-05T10:00:00.000Z" },
    { questaoId: "q3", erradaEm: "2026-10-03T10:00:00.000Z" },
    { questaoId: "q4", erradaEm: "2026-10-04T10:00:00.000Z" },
  ];
  assert.deepEqual(pendentesRefazer(erradas, new Set(["q3"]), new Set(["q1", "q2", "q3"])), ["q2", "q1"]);
});
test("pendentes: repetida conta uma vez, com a data mais recente; empate pelo id", () => {
  const erradas = [
    { questaoId: "b", erradaEm: "2026-10-01T10:00:00.000Z" },
    { questaoId: "a", erradaEm: "2026-10-02T10:00:00.000Z" },
    { questaoId: "c", erradaEm: "2026-10-02T10:00:00.000Z" },
    { questaoId: "b", erradaEm: "2026-10-09T10:00:00.000Z" },
  ];
  assert.deepEqual(pendentesRefazer(erradas, new Set(), new Set(["a", "b", "c"])), ["b", "a", "c"]);
});
test("pendentes: refazer entregue em branco gasta a chance (refeitas vêm da ordem do treino)", () => {
  const erradas = [{ questaoId: "q1", erradaEm: "2026-10-01T10:00:00.000Z" }];
  assert.deepEqual(pendentesRefazer(erradas, new Set(["q1"]), new Set(["q1"])), []);
});
test("ehRefazer", () => {
  assert.equal(ehRefazer("refazer"), true);
  assert.equal(ehRefazer("pratica"), false);
  assert.equal(ehRefazer(null), false);
});
