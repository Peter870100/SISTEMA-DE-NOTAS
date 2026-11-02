import { test } from "node:test";
import assert from "node:assert/strict";
import { entraNoPainel } from "./acesso";

const agora = new Date("2026-11-02T12:00:00Z");
const emUmaHora = new Date(agora.getTime() + 3600_000).toISOString();
const haUmaHora = new Date(agora.getTime() - 3600_000).toISOString();

test("treino entra nas duas visões", () => {
  const s = { tipo: "treino" as const, correcao: "apos_prazo", fecha_em: null };
  assert.equal(entraNoPainel(s, agora, "aluno"), true);
  assert.equal(entraNoPainel(s, agora, "escola"), true);
});

test("professor com correção na hora entra", () => {
  assert.equal(entraNoPainel({ tipo: "professor", correcao: "na_hora", fecha_em: emUmaHora }, agora, "aluno"), true);
});

test("apos_prazo ainda aberto: aluno não vê, escola vê", () => {
  const s = { tipo: "professor" as const, correcao: "apos_prazo", fecha_em: emUmaHora };
  assert.equal(entraNoPainel(s, agora, "aluno"), false);
  assert.equal(entraNoPainel(s, agora, "escola"), true);
});

test("apos_prazo já fechado: aluno vê", () => {
  assert.equal(entraNoPainel({ tipo: "professor", correcao: "apos_prazo", fecha_em: haUmaHora }, agora, "aluno"), true);
});

test("apos_prazo sem fecha_em: aluno não vê", () => {
  assert.equal(entraNoPainel({ tipo: "professor", correcao: "apos_prazo", fecha_em: null }, agora, "aluno"), false);
});
