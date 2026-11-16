import { test } from "node:test";
import assert from "node:assert/strict";
import { pendentesRefazer, ehRefazer, refeitasDe } from "./refazer";

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
test("pendentes: refeita não volta", () => {
  const erradas = [{ questaoId: "q1", erradaEm: "2026-10-01T10:00:00.000Z" }];
  assert.deepEqual(pendentesRefazer(erradas, new Set(["q1"]), new Set(["q1"])), []);
});
test("ehRefazer", () => {
  assert.equal(ehRefazer("refazer"), true);
  assert.equal(ehRefazer("pratica"), false);
  assert.equal(ehRefazer(null), false);
});

const T = (o: { etapa: "refazer" | "pratica"; entregueEm: string | null; questaoIds: string[] }) => o;
test("refeitasDe: refazer entregue em branco gasta a chance", () => {
  assert.deepEqual(refeitasDe([T({ etapa: "refazer", entregueEm: "2026-11-02T11:30:00.000Z", questaoIds: ["q1", "q2"] })]), new Set(["q1", "q2"]));
});
test("refeitasDe: refazer aberto não conta", () => {
  assert.equal(refeitasDe([T({ etapa: "refazer", entregueEm: null, questaoIds: ["q1"] })]).size, 0);
});
test("refeitasDe: prática entregue não conta", () => {
  assert.equal(refeitasDe([T({ etapa: "pratica", entregueEm: "2026-11-02T11:30:00.000Z", questaoIds: ["q1"] })]).size, 0);
});
test("refeitasDe: refazeres entregues de conteúdos diferentes somam", () => {
  const e = "2026-11-02T11:30:00.000Z";
  assert.deepEqual(refeitasDe([T({ etapa: "refazer", entregueEm: e, questaoIds: ["q1"] }), T({ etapa: "refazer", entregueEm: e, questaoIds: ["q2", "q3"] })]), new Set(["q1", "q2", "q3"]));
});
