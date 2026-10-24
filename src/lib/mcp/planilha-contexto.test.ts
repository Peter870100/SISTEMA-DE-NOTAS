import { test } from "node:test";
import assert from "node:assert/strict";
import type { Escopo } from "./escopo";
import type { EscolaInfo } from "./leitura/comum";
import { contextoPlanilha, type DepsContextoPlanilha } from "./planilha-contexto";
import { Pergunta } from "./acoes/ator";
import { escolherAluno, escolherColuna, escolherTurma } from "../mcp-tools";

const STATUS = "00000000-0000-0000-0000-000000000001";
const escolas: EscolaInfo[] = [
  { id: STATUS, nome: "Colégio Status", slug: "status" },
  { id: "h1", nome: "HARMONIA", slug: "harmonia" },
];

function deps(o: Partial<DepsContextoPlanilha> & { chamadas?: string[] } = {}): DepsContextoPlanilha {
  const chamadas = o.chamadas ?? [];
  return {
    escopoDoTelefone: o.escopoDoTelefone ?? (async (t) => {
      chamadas.push(`telefone:${t}`);
      throw new Error("não deveria consultar o telefone");
    }),
    listarEscolas: o.listarEscolas ?? (async () => {
      chamadas.push("escolas");
      return escolas;
    }),
    contaDoDono: o.contaDoDono ?? (async () => {
      chamadas.push("dono");
      return { id: "d1" };
    }),
  };
}

test("professor sem telefone: Colégio Status e todas as turmas, como hoje", async () => {
  const chamadas: string[] = [];
  for (const professor_telefone of [undefined, "", "   "]) {
    const ctx = await contextoPlanilha("professor", { professor_telefone }, deps({ chamadas }));
    assert.deepEqual(ctx, { escolaId: STATUS, turmas: null, ator: null, registro: { perfil: "professor", professorId: null } });
  }
  assert.deepEqual(chamadas, [], "sem telefone não consulta nada");
});

test("professor sem telefone: o parâmetro escola é ignorado", async () => {
  const ctx = await contextoPlanilha("professor", { escola: "harmonia" }, deps());
  assert.ok(!("pergunta" in ctx));
  assert.equal(ctx.escolaId, STATUS);
});

test("professor com telefone de outra escola: age na escola dele, com as turmas liberadas", async () => {
  const escopo: Escopo = { tipo: "professor", escolaId: "h1", professorId: "p9", turmas: new Set(["1A"]), papel: "professor" };
  let pedido: string | undefined;
  const ctx = await contextoPlanilha("professor", { professor_telefone: " 5511999 " }, deps({
    escopoDoTelefone: async (t) => { pedido = t; return escopo; },
  }));
  assert.equal(pedido, " 5511999 ");
  assert.ok(!("pergunta" in ctx));
  assert.equal(ctx.escolaId, "h1");
  assert.notEqual(ctx.escolaId, STATUS);
  assert.deepEqual([...(ctx.turmas ?? [])], ["1A"]);
  assert.deepEqual(ctx.ator, { id: "p9", role: "professor" });
  assert.deepEqual(ctx.registro, { perfil: "professor", professorId: "p9" });
});

test("professor com telefone: admin vê todas as turmas e o papel vem do escopo", async () => {
  const escopo: Escopo = { tipo: "professor", escolaId: STATUS, professorId: "p2", turmas: null, papel: "admin" };
  const ctx = await contextoPlanilha("professor", { professor_telefone: "55" }, deps({ escopoDoTelefone: async () => escopo }));
  assert.ok(!("pergunta" in ctx));
  assert.equal(ctx.turmas, null);
  assert.deepEqual(ctx.ator, { id: "p2", role: "admin" });
});

test("professor com telefone desconhecido: o erro do escopo sobe", async () => {
  await assert.rejects(
    contextoPlanilha("professor", { professor_telefone: "000" }, deps({
      escopoDoTelefone: async () => { throw new Error("Telefone não cadastrado como professor."); },
    })),
    /Telefone não cadastrado como professor\./,
  );
});

test("dono com duas escolas e sem escola: pergunta qual, sem erro", async () => {
  const ctx = await contextoPlanilha("dono", {}, deps());
  assert.deepEqual(ctx, { pergunta: "Diga em qual escola: Colégio Status, HARMONIA. Nada foi feito." });
});

test("dono com escola: 'harmonia' → a HARMONIA, registro com a conta do dono", async () => {
  const ctx = await contextoPlanilha("dono", { escola: "harmonia", professor_telefone: "55" }, deps());
  assert.deepEqual(ctx, { escolaId: "h1", turmas: null, ator: { id: "d1", role: "dono" }, registro: { perfil: "dono", professorId: "d1" } });
});

test("dono: nome da escola sem acento e parcial também acha", async () => {
  const ctx = await contextoPlanilha("dono", { escola: "colegio" }, deps());
  assert.ok(!("pergunta" in ctx));
  assert.equal(ctx.escolaId, STATUS);
});

test("dono: escola inexistente é erro com a lista", async () => {
  await assert.rejects(contextoPlanilha("dono", { escola: "xyz" }, deps()), /Escola "xyz" não encontrada\. Escolas: Colégio Status, HARMONIA\./);
});

test("dono com uma escola só: não precisa dizer qual", async () => {
  const ctx = await contextoPlanilha("dono", {}, deps({ listarEscolas: async () => [escolas[1]] }));
  assert.ok(!("pergunta" in ctx));
  assert.equal(ctx.escolaId, "h1");
});

test("dono: nome que bate em duas escolas pergunta qual", async () => {
  const duas: EscolaInfo[] = [{ id: "a", nome: "Escola Sol", slug: "sol" }, { id: "b", nome: "Escola Solar", slug: "solar" }];
  const ctx = await contextoPlanilha("dono", { escola: "escola" }, deps({ listarEscolas: async () => duas }));
  assert.deepEqual(ctx, { pergunta: "Diga em qual escola: Escola Sol, Escola Solar. Nada foi feito." });
});

// ---------- nomes nas ferramentas da planilha: ler mantém a busca de hoje; gravar exige o nome exato ----------

const t = (id: string, nome: string, bimestre = "2º Bimestre") => ({ id, nome, bimestre, ano_letivo: "2026" });
const turmas = [t("a", "1ª série A"), t("a2", "1ª série A2"), t("b", "2ª série B"), t("b1", "2ª série B", "1º Bimestre")];

test("turma: ler aceita parte do nome, como hoje", () => {
  assert.equal(escolherTurma(turmas, "2ª série", "2º", null, false).id, "b");
  assert.equal(escolherTurma(turmas, "serie b", "2º Bimestre", null, false).id, "b");
});

test("turma: gravar com nome parcial único pergunta, sem agir", () => {
  assert.throws(() => escolherTurma(turmas, "serie b", "2º Bimestre", null, true), (e: Error) =>
    e instanceof Pergunta && e.message === 'Achei só a turma 2ª série B para "serie b". É essa? Nada foi feito; repita com o nome completo.');
});

test("turma: gravar com o nome exato (sem acento e caixa) age, mesmo havendo nome parecido", () => {
  assert.equal(escolherTurma(turmas, "1ª SÉRIE a", undefined, null, true).id, "a");
  assert.equal(escolherTurma(turmas, "2ª série B", "1º", null, true).id, "b1");
});

test("turma: mensagens de hoje para nenhuma e várias", () => {
  assert.throws(() => escolherTurma(turmas, "3ª", undefined, null, false), /^Error: Nenhuma turma encontrada com nome parecido com "3ª"\.$/);
  assert.throws(() => escolherTurma(turmas, "2ª série B", undefined, null, true),
    (e: Error) => !(e instanceof Pergunta) && e.message === 'Mais de uma turma encontrada para "2ª série B": "2ª série B" (2º Bimestre), "2ª série B" (1º Bimestre). Informe também o bimestre pra desambiguar.');
});

test("turma: fora das liberadas → sem acesso", () => {
  const liberadas = new Set(["2ª série B"]);
  assert.throws(() => escolherTurma(turmas, "1ª série A", undefined, liberadas, true), /^Error: Você não tem acesso à turma 1ª série A\.$/);
  assert.equal(escolherTurma(turmas, "2ª série B", "2º", liberadas, true).id, "b");
  assert.throws(() => escolherTurma(turmas, "9ª", undefined, liberadas, false), /\(ou você não tem acesso a ela\)\./);
});

const alunos = [{ id: "1", nome: "Ana Maria" }, { id: "2", nome: "Ana Paula" }, { id: "3", nome: "Bruno" }, { id: "4", nome: "Ana" }];

test("aluno: ler/gravar com nome exato; parcial único pergunta ao gravar", () => {
  assert.equal(escolherAluno(alunos, "bru", false).id, "3");
  assert.throws(() => escolherAluno(alunos, "bru", true), (e: Error) =>
    e instanceof Pergunta && e.message === 'Achei só o aluno Bruno para "bru". É esse? Nada foi feito; repita com o nome completo.');
  assert.equal(escolherAluno(alunos, "ANA", true).id, "4");
  assert.equal(escolherAluno(alunos, "ana paula", true).id, "2");
});

test("aluno: mensagens de hoje para nenhum e vários", () => {
  assert.throws(() => escolherAluno(alunos, "Carla", true), /^Error: Nenhum aluno encontrado com nome parecido com "Carla" nessa turma\.$/);
  assert.throws(() => escolherAluno(alunos, "Ana ", false), /^Error: Mais de um aluno encontrado para "Ana ": "Ana Maria", "Ana Paula", "Ana"\. Seja mais específico\.$/);
  assert.throws(() => escolherAluno(alunos, "Ana P", true), (e: Error) => e instanceof Pergunta);
  assert.throws(() => escolherAluno([...alunos, { id: "5", nome: "bruno" }], "Bruno", true), /Mais de um aluno encontrado para "Bruno"/);
});

const colunas = [{ id: "c1", titulo: "Prova" }, { id: "c2", titulo: "Prova 2" }, { id: "c3", titulo: "Trabalho" }, { id: "c4", titulo: "Prova" }];

test("coluna: exata age; parcial única pergunta; repetida lista posições", () => {
  assert.deepEqual(escolherColuna(colunas, "trabalho", undefined), { coluna: colunas[2] });
  assert.throws(() => escolherColuna(colunas, "trab", undefined), (e: Error) =>
    e instanceof Pergunta && e.message === 'Achei só a coluna Trabalho para "trab". É essa? Nada foi feito; repita com o título completo.');
  assert.deepEqual(escolherColuna(colunas, "prova", undefined), { varias: [{ coluna: colunas[0], posicao: 1 }, { coluna: colunas[3], posicao: 4 }] });
  assert.deepEqual(escolherColuna(colunas, "Prova", 4), { coluna: colunas[3] });
  assert.deepEqual(escolherColuna(colunas, "prova 2", undefined), { coluna: colunas[1] });
});

test("coluna: mensagens de hoje para nenhuma e posição errada", () => {
  assert.throws(() => escolherColuna(colunas, "Teste", undefined), /^Error: Nenhuma coluna encontrada com título parecido com "Teste" nessa turma\.$/);
  assert.throws(() => escolherColuna(colunas, "Prova", 3), /^Error: A coluna na posição 3 não tem título parecido com "Prova"\. Confira as posições com ver_planilha\.$/);
  assert.throws(() => escolherColuna(colunas, "Prov", 2), (e: Error) => e instanceof Pergunta && /Prova 2/.test(e.message));
});

// ---------- linhas por item dos lotes e criar_turma ----------

import { motivoDoItem, podeCriarTurma } from "../mcp-tools";

test("motivoDoItem: nome parcial diz que só o item não foi lançado, sem 'Nada foi feito'", () => {
  let erro: unknown;
  try { escolherAluno(alunos, "bru", true); } catch (e) { erro = e; }
  const m = motivoDoItem(erro);
  assert.equal(m, 'achei só "Bruno"; este item não foi lançado, repita com o nome completo');
  assert.ok(!/Nada foi feito/.test(m));
  try { escolherColuna(colunas, "trab", undefined); } catch (e) { erro = e; }
  assert.match(motivoDoItem(erro), /^achei só "Trabalho"; este item não foi lançado/);
  assert.equal(motivoDoItem(new Pergunta("Achei só X. Nada foi feito; repita.")), "Achei só X. Este item não foi lançado; repita.");
  assert.equal(motivoDoItem(new Error("status inválido")), "status inválido");
});

test("podeCriarTurma: professor comum não cria; admin, dono e sem telefone criam", () => {
  assert.equal(podeCriarTurma({ id: "p", role: "professor" }), false);
  assert.equal(podeCriarTurma({ id: "a", role: "admin" }), true);
  assert.equal(podeCriarTurma({ id: "d", role: "dono" }), true);
  assert.equal(podeCriarTurma(null), true);
});
