import assert from "node:assert/strict";
import test from "node:test";
import type { Letra, SituacaoEstudo } from "../types";
import { moverMaterialAoJuntar, relatarErroCom, relatorDaSessao, salvarExercicioCom, type DepsExercicio, responderExercicioCom, type DepsRelato, type DepsResposta, type EntradaRelato, type Relator } from "./nucleo";

function deps(o: { certa: Letra; situacao?: SituacaoEstudo; material_situacao?: SituacaoEstudo; nulo?: boolean; jaGravada?: { marcada: Letra; acertou: boolean } }): DepsResposta {
  return {
    exercicio: async () =>
      o.nulo ? null : { resposta_correta: o.certa, comentario: "porque sim", situacao: o.situacao ?? "publicado", material_situacao: o.material_situacao ?? "publicado" },
    gravar: async (_c, _e, marcada, acertou) => o.jaGravada ?? { marcada, acertou },
  };
}

function depsRelato(o: { anterior?: "aberto" | "sem_erro" | null; hoje?: number; noAr?: boolean }) {
  const inseridos: [Relator, EntradaRelato][] = [];
  const tirados: [string, string | null][] = [];
  const d: DepsRelato & { inseridos: typeof inseridos; tirados: typeof tirados } = {
    inseridos,
    tirados,
    noAr: async () => o.noAr ?? true,
    relatoAnterior: async () => o.anterior ?? null,
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
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: "e", mensagem: null }), { ok: true, saiuDoAr: true });
  assert.equal(d.inseridos.length, 1);
  assert.deepEqual(d.tirados, [["m", "e"]]);
});
test("aviso aberto com o item ainda no ar tira do ar sem inserir de novo", async () => {
  const d = depsRelato({ anterior: "aberto" });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: "e", mensagem: null }), { ok: true, saiuDoAr: true });
  assert.equal(d.inseridos.length, 0);
  assert.deepEqual(d.tirados, [["m", "e"]]);
});
test("aviso conferido como sem erro não tira do ar de novo", async () => {
  const d = depsRelato({ anterior: "sem_erro" });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }), { ok: true, saiuDoAr: false });
  assert.equal(d.inseridos.length, 0);
  assert.equal(d.tirados.length, 0);
});
test("sexto aviso do dia é recusado", async () => {
  const d = depsRelato({ hoje: 5 });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }),
    { ok: false, erro: "Você já enviou 5 avisos hoje. Tente de novo amanhã." });
  assert.equal(d.tirados.length, 0);
});
test("item que já saiu do ar não gera novo aviso", async () => {
  const d = depsRelato({ noAr: false });
  assert.deepEqual(await relatarErroCom(d, { conta_id: "c" }, { materialId: "m", exercicioId: null, mensagem: null }), { ok: true, saiuDoAr: true });
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

// ---------- relatorDaSessao ----------

test("relatorDaSessao: aluno vale antes do professor; sem nenhum, nulo", () => {
  assert.deepEqual(relatorDaSessao({ id: "a" }, null), { conta_id: "a" });
  assert.deepEqual(relatorDaSessao({ id: "a" }, { id: "p" }), { conta_id: "a" });
  assert.deepEqual(relatorDaSessao(null, { id: "p" }), { professor_id: "p" });
  assert.equal(relatorDaSessao(null, null), null);
});

// ---------- salvarExercicioCom ----------

const ALTS = (["A", "B", "C", "D", "E"] as const).map((letra) => ({ letra, texto: `alt ${letra}` }));
const ANTES = { material_id: "m1", enunciado: "Enun", imagem_id: null, alternativas: ALTS, resposta_correta: "B" as Letra };
const CAMPOS = { enunciado: "Enun", imagem_id: null, alternativas: ALTS, resposta_correta: "B" as Letra, comentario: "Novo comentário" };

function depsEx(o: { existe?: boolean } = {}) {
  const chamadas: string[] = [];
  let gravado: Record<string, unknown> | null = null;
  const d: DepsExercicio & { chamadas: string[]; gravado: () => Record<string, unknown> | null } = {
    chamadas,
    gravado: () => gravado,
    ler: async () => (o.existe === false ? null : ANTES),
    desenhoDoMaterial: async () => true,
    apagarRespostas: async () => { chamadas.push("apagar"); },
    publicar: async (_id, c) => { chamadas.push("publicar"); gravado = c; },
    fecharAvisos: async () => { chamadas.push("fechar"); },
  };
  return d;
}

test("salvarExercicio: mudar o gabarito apaga as respostas", async () => {
  const d = depsEx();
  const r = await salvarExercicioCom(d, "e1", { ...CAMPOS, resposta_correta: "C" });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(d.chamadas, ["apagar", "publicar", "fechar"]);
});

test("salvarExercicio: mudar só o comentário não apaga as respostas", async () => {
  const d = depsEx();
  const r = await salvarExercicioCom(d, "e1", CAMPOS);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(d.chamadas, ["publicar", "fechar"]);
  assert.equal(d.gravado()!.comentario, "Novo comentário");
});

test("salvarExercicio: o dono publica exercício retido mesmo com checagens esgotadas", async () => {
  // O núcleo não consulta checagens: salvar sempre publica e zera o motivo.
  const d = depsEx();
  await salvarExercicioCom(d, "e1", CAMPOS);
  assert.equal(d.gravado()!.situacao, "publicado");
  assert.equal(d.gravado()!.motivo, null);
});

test("salvarExercicio: recusa campos inválidos e exercício inexistente", async () => {
  assert.equal((await salvarExercicioCom(depsEx(), "e1", { ...CAMPOS, enunciado: " " })).ok, false);
  assert.equal((await salvarExercicioCom(depsEx(), "e1", { ...CAMPOS, comentario: "" })).ok, false);
  assert.equal((await salvarExercicioCom(depsEx(), "e1", { ...CAMPOS, alternativas: ALTS.slice(0, 4) })).ok, false);
  assert.equal((await salvarExercicioCom(depsEx({ existe: false }), "e1", CAMPOS)).ok, false);
});
