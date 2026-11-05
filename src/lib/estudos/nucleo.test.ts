import assert from "node:assert/strict";
import test from "node:test";
import type { Letra, SituacaoEstudo } from "../types";
import { moverMaterialAoJuntar, relatarErroCom, responderExercicioCom, type DepsRelato, type DepsResposta, type EntradaRelato, type Relator } from "./nucleo";

function deps(o: { certa: Letra; situacao?: SituacaoEstudo; material_situacao?: SituacaoEstudo; nulo?: boolean; jaGravada?: { marcada: Letra; acertou: boolean } }): DepsResposta {
  return {
    exercicio: async () =>
      o.nulo ? null : { resposta_correta: o.certa, comentario: "porque sim", situacao: o.situacao ?? "publicado", material_situacao: o.material_situacao ?? "publicado" },
    gravar: async (_c, _e, marcada, acertou) => o.jaGravada ?? { marcada, acertou },
  };
}

function depsRelato(o: { jaRelatou?: boolean; hoje?: number; noAr?: boolean }) {
  const inseridos: [Relator, EntradaRelato][] = [];
  const tirados: [string, string | null][] = [];
  const d: DepsRelato & { inseridos: typeof inseridos; tirados: typeof tirados } = {
    inseridos,
    tirados,
    noAr: async () => o.noAr ?? true,
    jaRelatou: async () => o.jaRelatou ?? false,
    relatosHoje: async () => o.hoje ?? 0,
    inserir: async (q, e) => { inseridos.push([q, e]); },
    tirarDoAr: async (m, e) => { tirados.push([m, e]); },
  };
  return d;
}

test("responde e corrige", async () => {
  const r = await responderExercicioCom(deps({ certa: "C" }), "conta", { exercicioId: "e", marcada: "C" });
  assert.deepEqual(r, { ok: true, marcada: "C", acertou: true, certa: "C", comentario: "porque sim" });
});
test("vale a primeira resposta, mesmo em outra aba", async () => {
  const d = deps({ certa: "C", jaGravada: { marcada: "B", acertou: false } });
  const r = await responderExercicioCom(d, "conta", { exercicioId: "e", marcada: "C" });
  assert.ok(r.ok);
  assert.equal(r.marcada, "B");
  assert.equal(r.acertou, false);
});
test("exercício fora do ar não responde", async () => {
  for (const o of [{ situacao: "em_conferencia" as const }, { material_situacao: "em_conferencia" as const }, { nulo: true }]) {
    const r = await responderExercicioCom(deps({ certa: "C", ...o }), "conta", { exercicioId: "e", marcada: "C" });
    assert.deepEqual(r, { ok: false, erro: "Este exercício saiu do ar para conferência." });
  }
});
test("avisar erro tira do ar", async () => {
  const d = depsRelato({});
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: "e", mensagem: null }), { ok: true });
  assert.equal(d.inseridos.length, 1);
  assert.deepEqual(d.tirados, [["m", "e"]]);
});
test("aviso repetido não conta nem insere", async () => {
  const d = depsRelato({ jaRelatou: true });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }), { ok: true });
  assert.equal(d.inseridos.length, 0);
});
test("sexto aviso do dia é recusado", async () => {
  const d = depsRelato({ hoje: 5 });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }),
    { ok: false, erro: "Você já enviou 5 avisos hoje. Tente de novo amanhã." });
  assert.equal(d.tirados.length, 0);
});
test("item que já saiu do ar não gera novo aviso", async () => {
  const d = depsRelato({ noAr: false });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }), { ok: true });
  assert.equal(d.inseridos.length, 0);
});
test("mensagem acima de 500 caracteres é recusada", async () => {
  const r = await relatarErroCom(depsRelato({}), { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: "a".repeat(501) });
  assert.equal(r.ok, false);
});
test("juntar move o material só se o destino não tiver", async () => {
  const mov: string[][] = [];
  await moverMaterialAoJuntar({ temMaterial: async (id) => id === "p", mover: async (a, b) => { mov.push([a, b]); } }, "p", "d");
  assert.deepEqual(mov, [["p", "d"]]);
  await moverMaterialAoJuntar({ temMaterial: async () => true, mover: async () => { throw new Error("não"); } }, "p", "d");
  await moverMaterialAoJuntar({ temMaterial: async (id) => id === "d", mover: async () => { throw new Error("não"); } }, "p", "d");
});
