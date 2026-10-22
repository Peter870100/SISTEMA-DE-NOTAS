import { test } from "node:test";
import assert from "node:assert/strict";
import { executarRegistrado, resumirParametros, situacaoNaTela, textoParametros, type GravadorRegistro } from "./registro";

test("string longa e cortada em 200 caracteres", () => {
  assert.equal(resumirParametros("a".repeat(500)), "a".repeat(200) + "…");
  assert.equal(resumirParametros("curta"), "curta");
});

test("lista de 50 vira 20 itens mais o resumo", () => {
  const r = resumirParametros(Array.from({ length: 50 }, (_, i) => i)) as unknown[];
  assert.equal(r.length, 21);
  assert.equal(r[19], 19);
  assert.equal(r[20], "… e mais 30");
});

test("chaves sensiveis viram ***", () => {
  const r = resumirParametros({ senha: "x", token: "y", professor_telefone: "6799", ok: 1 }) as Record<string, unknown>;
  assert.equal(r.senha, "***");
  assert.equal(r.token, "***");
  assert.equal(r.professor_telefone, "***");
  assert.equal(r.ok, 1);
});

test("profundidade maior que 3 vira reticencias", () => {
  const r = resumirParametros({ a: { b: { c: { d: 1 } } } }) as { a: { b: { c: unknown } } };
  assert.equal(r.a.b.c, "…");
});

const ctxReg = { perfil: "dono" as const, professorId: "d1", escolaId: "e1" };
function gravadorFalso(opcoes: { falhaIniciar?: boolean; falhaFechar?: boolean } = {}) {
  const fechados: string[] = [];
  const g: GravadorRegistro = {
    async iniciar() { if (opcoes.falhaIniciar) throw new Error("sem tabela"); return "r1"; },
    async fechar(_id, campos) { fechados.push(campos.situacao); if (opcoes.falhaFechar) throw new Error("caiu"); },
  };
  return { g, fechados };
}

test("executarRegistrado: sucesso fecha como concluida e devolve o resultado", async () => {
  const { g, fechados } = gravadorFalso();
  assert.equal(await executarRegistrado(ctxReg, "x", {}, async () => 42, g), 42);
  assert.deepEqual(fechados, ["concluida"]);
});

test("executarRegistrado: falha ao marcar concluida não vira erro (a Hermes não repete a ação)", async () => {
  const { g, fechados } = gravadorFalso({ falhaFechar: true });
  let vezes = 0;
  assert.equal(await executarRegistrado(ctxReg, "x", {}, async () => { vezes++; return "ok"; }, g), "ok");
  assert.equal(vezes, 1);
  assert.deepEqual(fechados, ["concluida"]);
});

test("executarRegistrado: erro da ação é relançado, mesmo se marcar 'erro' falhar", async () => {
  const { g, fechados } = gravadorFalso({ falhaFechar: true });
  await assert.rejects(executarRegistrado(ctxReg, "x", {}, async () => { throw new Error("original"); }, g), { message: "original" });
  assert.deepEqual(fechados, ["erro"]);
});

test("executarRegistrado: sem registro a ação não roda", async () => {
  const { g } = gravadorFalso({ falhaIniciar: true });
  let rodou = false;
  await assert.rejects(executarRegistrado(ctxReg, "x", {}, async () => { rodou = true; }, g), /Não foi possível registrar a ação da Hermes: sem tabela/);
  assert.equal(rodou, false);
});

test("textoParametros: chave: valor em texto puro, com limite", () => {
  assert.equal(textoParametros({ simulado_id: "abc", quantidade: 10, publicar: true, assunto: null }), "simulado_id: abc · quantidade: 10 · publicar: true · assunto: —");
  assert.equal(textoParametros({ turmas: ["1A", "1B"], professor_telefone: "***" }), 'turmas: ["1A","1B"] · professor_telefone: ***');
  assert.equal(textoParametros({ enunciado: "<b>x</b>\n\ny" }), "enunciado: <b>x</b> y");
  assert.equal(textoParametros({ a: "x".repeat(400) }, 20), "a: " + "x".repeat(17) + "…");
  assert.equal(textoParametros(null), "");
  assert.equal(textoParametros([1, 2]), "");
  assert.equal(textoParametros({}), "");
});

test("situacaoNaTela: iniciada há mais de 5 minutos vira sem confirmação", () => {
  const criado = "2026-10-22T12:00:00.000Z";
  const t0 = Date.parse(criado);
  assert.equal(situacaoNaTela("iniciada", criado, t0 + 4 * 60_000), "iniciada");
  assert.equal(situacaoNaTela("iniciada", criado, t0 + 5 * 60_000), "iniciada");
  assert.equal(situacaoNaTela("iniciada", criado, t0 + 5 * 60_000 + 1), "sem_confirmacao");
  assert.equal(situacaoNaTela("concluida", criado, t0 + 60 * 60_000), "concluida");
  assert.equal(situacaoNaTela("erro", criado, t0 + 60 * 60_000), "erro");
});
