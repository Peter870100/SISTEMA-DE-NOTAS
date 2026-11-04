import { test } from "node:test";
import assert from "node:assert/strict";
import { selecionarQuestoes, ordenarPorFacilidade, facilidadeDe, contarDisponiveis, type Candidata } from "./selecao";

const agora = new Date("2026-11-03T12:00:00Z");
const q = (id: string, o: Partial<Candidata> = {}): Candidata => ({ id, topicoId: null, habilidadeIds: [], ultimaVez: null, ...o });
const fixo = () => 0.5;
test("exclui as vistas há menos de diasSemRepetir e põe as novas antes das antigas", () => {
  const r = selecionarQuestoes({ candidatas: [q("velha", { ultimaVez: "2026-09-01T00:00:00Z" }), q("recente", { ultimaVez: "2026-10-30T00:00:00Z" }), q("nova")], quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: fixo });
  assert.deepEqual(r, { ids: ["nova", "velha"], faltaram: 1, repetidas: 1 });
});
test("relevância: foco+habilidade, foco, habilidade, resto", () => {
  const cs = [q("resto"), q("hab", { habilidadeIds: ["h1"] }), q("foco", { topicoId: "t1" }), q("ambos", { topicoId: "t1", habilidadeIds: ["h1"] })];
  assert.deepEqual(selecionarQuestoes({ candidatas: cs, quantidade: 4, focoTopicoId: "t1", habilidadeIds: ["h1"], agora, diasSemRepetir: 30, sortear: fixo }).ids, ["ambos", "foco", "hab", "resto"]);
});
test("antigas da mais antiga para a mais recente", () => {
  const cs = [q("b", { ultimaVez: "2026-08-01T00:00:00Z" }), q("a", { ultimaVez: "2026-07-01T00:00:00Z" })];
  assert.deepEqual(selecionarQuestoes({ candidatas: cs, quantidade: 2, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30 }).ids, ["a", "b"]);
});
test("sorteio injetado decide a ordem dentro do mesmo grupo e relevância", () => {
  const cs = [q("x"), q("y"), q("z")];
  const a = selecionarQuestoes({ candidatas: cs, quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: () => 0 }).ids;
  const b = selecionarQuestoes({ candidatas: cs, quantidade: 3, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 30, sortear: () => 0.99 }).ids;
  assert.deepEqual([...a].sort(), ["x", "y", "z"]); assert.notDeepEqual(a, b);
});
test("diasSemRepetir 0 não exclui nada", () => {
  assert.equal(selecionarQuestoes({ candidatas: [q("r", { ultimaVez: "2026-11-03T11:00:00Z" })], quantidade: 1, focoTopicoId: null, habilidadeIds: [], agora, diasSemRepetir: 0 }).ids.length, 1);
});
test("ordenarPorFacilidade: mais fácil primeiro, nula no meio, estável", () => {
  assert.deepEqual(ordenarPorFacilidade(["d", "n", "f", "m"], { d: 20, n: null, f: 80, m: 50 }), ["f", "n", "m", "d"]);
});
test("facilidadeDe: uso com 5+ respostas, senão geração, senão nula", () => {
  assert.equal(facilidadeDe({ acertos: 4, total: 5 }, "dificil"), 80);
  assert.equal(facilidadeDe({ acertos: 1, total: 4 }, "dificil"), 20);
  assert.equal(facilidadeDe(null, "facil"), 80); assert.equal(facilidadeDe(null, null), null);
});
test("contarDisponiveis: novas e vistas há tempo; sem as recentes", () => {
  assert.equal(contarDisponiveis([q("n"), q("v", { ultimaVez: "2026-01-01T00:00:00Z" }), q("r", { ultimaVez: "2026-11-01T00:00:00Z" })], agora, 30), 2);
});
