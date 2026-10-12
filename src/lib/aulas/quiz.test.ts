import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import * as zod from "zod";
import * as quiz from "./quiz";

const aulaId = "11111111-1111-4111-8111-111111111111";
const versao = "22222222-2222-4222-8222-222222222222";
const perguntas = Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), enunciado: `Qual a resposta para a pergunta ${i + 1}?`, alternativas: ["Primeira", "Segunda", "Terceira", "Quarta"], correta: i, explicacao: "Esta resposta representa o conceito apresentado na aula." }));

test("quiz: exige 3 a 5 perguntas completas e alternativas diferentes", () => {
  assert.equal(quiz.QuizSchema.safeParse(perguntas).success, true);
  for (const dados of [[], perguntas.slice(0, 2), [...perguntas, ...perguntas], perguntas.map(p => ({ ...p, correta: 4 })), perguntas.map(p => ({ ...p, alternativas: ["A", "a", "B", "C"] })), perguntas.map(p => ({ ...p, explicacao: "" }))]) assert.equal(quiz.QuizSchema.safeParse(dados).success, false);
});
test("quiz: rascunho aceita perguntas incompletas sem publicar", () => {
  assert.equal(quiz.RascunhoQuizSchema.safeParse([{ ...perguntas[0], enunciado: "", explicacao: "", alternativas: ["", "", "", ""] }]).success, true);
});
test("quiz: aluno recebe perguntas sem gabarito ou explicacoes", () => {
  for (const p of quiz.perguntasParaAluno(perguntas)) { assert.equal("correta" in p, false); assert.equal("explicacao" in p, false); assert.equal(p.alternativas.length, 4); }
});
test("quiz: correcao usa gabarito do servidor e rejeita respostas incompletas", () => {
  const resultado = quiz.corrigirQuiz(perguntas, [0, 0, 2]); assert.equal(resultado.acertos, 2); assert.equal(resultado.porcentagem, 67);
  for (const respostas of [[0], [0, 1, 2, 3], [0, 1, 4], [null, 1, 2], { acertos: 3 }]) assert.throws(() => quiz.corrigirQuiz(perguntas, respostas));
});

type Cenario = { professor?: boolean; aluno?: boolean; acesso?: boolean; concluida?: boolean; publicado?: boolean; erroSalvar?: boolean };
function acoes(c: Cenario = {}) {
  const chamadas: { tabela: string; operacao: string; dados?: unknown }[] = [];
  const criarConsulta = (tabela: string, privado: boolean) => {
    const filtros: Record<string, unknown> = {};
    const consulta = {
      select: () => consulta,
      eq: (campo: string, valor: unknown) => { filtros[campo] = valor; return consulta; },
      maybeSingle: async () => {
        if (tabela === "aulas") return { data: { id: aulaId, curso_id: "curso", titulo: "Dinamica" }, error: null };
        if (tabela === "aula_progresso") return { data: { concluida_em: c.concluida === false ? null : "2026-10-11" }, error: null };
        if (tabela === "aula_quizzes") return { data: c.publicado === false || filtros.versao !== versao ? null : { perguntas, versao }, error: null };
        throw Error(tabela);
      },
      upsert: (dados: unknown) => { chamadas.push({ tabela, operacao: "upsert", dados }); return Promise.resolve({ error: c.erroSalvar ? { code: "network" } : null }); },
      update: (dados: unknown) => { chamadas.push({ tabela, operacao: "update", dados }); return consulta; },
      insert: async (dados: unknown) => { chamadas.push({ tabela, operacao: "insert", dados }); return { error: c.erroSalvar ? { code: "network" } : null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    if (privado) chamadas.push({ tabela, operacao: "consulta" });
    return consulta;
  };
  const deps: Record<string, unknown> = {
    "node:crypto": { randomUUID }, "zod": zod,
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/supabase/client": { supabase: { from: (t: string) => criarConsulta(t, false) } },
    "@/lib/auth": { getAlunoAtual: async () => c.aluno === false ? null : { id: "conta-autenticada", escola_id: "escola" } },
    "@/lib/aulas/acesso": { exigirCursoEditavel: async () => { if (c.professor === false) throw Error("Sem permissao"); return { professor: { id: randomUUID() } }; }, obterAulaParaAluno: async () => c.acesso === false ? null : { aula: { id: aulaId } } },
    "@/lib/aulas/quiz-banco": { bancoQuiz: () => ({ from: (t: string) => criarConsulta(t, true) }), erroBancoQuiz: () => Error("Banco indisponivel") },
    "@/lib/aulas/quiz": quiz,
    "@/lib/aulas/quiz-ia": { gerarRascunhoQuiz: async () => perguntas },
  };
  const exports: { salvarQuizAula: (id: string, p: unknown, modo: string) => Promise<void>; responderQuizAula: (id: string, v: string, r: unknown) => Promise<quiz.ResultadoQuiz>; gerarQuizComIA: (id: string, dados: unknown) => Promise<quiz.PerguntaQuiz[]> } = {} as never;
  const js = transpileModule(readFileSync("src/actions/quiz-aulas.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports, Date, Map, require: (nome: string) => { if (!(nome in deps)) throw Error(nome); return deps[nome]; } });
  return { ...exports, chamadas };
}

test("quiz: professor sem acesso nao altera nem gera perguntas", async () => {
  const a = acoes({ professor: false }); await assert.rejects(a.salvarQuizAula(aulaId, perguntas, "publicar")); await assert.rejects(a.gerarQuizComIA(aulaId, {})); assert.equal(a.chamadas.length, 0);
});
test("quiz: salvar rascunho nunca substitui perguntas publicadas", async () => {
  const a = acoes(); await a.salvarQuizAula(aulaId, perguntas, "rascunho");
  const dados = a.chamadas.find(c => c.operacao === "upsert")!.dados as Record<string, unknown>;
  assert.equal("perguntas" in dados, false); assert.equal("publicado" in dados, false); assert.equal("versao" in dados, false);
});
test("quiz: publicar cria nova versao validada", async () => {
  const a = acoes(); await a.salvarQuizAula(aulaId, perguntas, "publicar"); const dados = a.chamadas.find(c => c.operacao === "upsert")!.dados as Record<string, unknown>;
  assert.equal(dados.publicado, true); assert.ok(dados.versao); assert.deepEqual(dados.perguntas, perguntas);
});
test("quiz: visitante, outra turma e aula incompleta nao acessam correcao", async () => {
  for (const c of [{ aluno: false }, { acesso: false }, { concluida: false }]) {
    const a = acoes(c); await assert.rejects(a.responderQuizAula(aulaId, versao, [0, 1, 2])); assert.equal(a.chamadas.length, 0);
  }
});
test("quiz: tentativa salva somente na conta autenticada e nao altera progresso", async () => {
  const a = acoes(); const r = await a.responderQuizAula(aulaId, versao, [0, 1, 2]); assert.equal(r.acertos, 3);
  const escrita = a.chamadas.filter(c => c.operacao === "insert"); assert.equal(escrita.length, 1); assert.equal(escrita[0].tabela, "aula_quiz_tentativas"); assert.equal((escrita[0].dados as { conta_id: string }).conta_id, "conta-autenticada");
});
test("quiz: versao antiga, quiz retirado ou falha ao salvar nao confirmam resultado", async () => {
  await assert.rejects(acoes().responderQuizAula(aulaId, randomUUID(), [0, 1, 2]), /atualizou/);
  await assert.rejects(acoes({ publicado: false }).responderQuizAula(aulaId, versao, [0, 1, 2]));
  await assert.rejects(acoes({ erroSalvar: true }).responderQuizAula(aulaId, versao, [0, 1, 2]), /Banco/);
});
test("quiz: IA exige material suficiente e gera somente rascunho", async () => {
  const a = acoes(); await assert.rejects(a.gerarQuizComIA(aulaId, { fonte: "apenas um titulo", quantidade: 3, dificuldade: "media" }));
  const novas = await a.gerarQuizComIA(aulaId, { fonte: "Conteudo da aula de dinamica. ".repeat(10), quantidade: 3, dificuldade: "media" }); assert.equal(novas.length, 3); assert.equal(a.chamadas.length, 0);
});
test("quiz: migracao e idempotente, preserva aulas e bloqueia acesso anonimo", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table aulas(id uuid primary key); create table alunos_contas(id uuid primary key);");
    const sql = readFileSync("db/2026-10-11-quiz-aulas.sql", "utf8"); await db.exec(sql); await db.exec(sql);
    const permissoes = await db.query<{ leitura: boolean; escrita: boolean }>("select has_table_privilege('anon','public.aula_quizzes','select') as leitura,has_table_privilege('authenticated','public.aula_quiz_tentativas','insert') as escrita");
    assert.equal(permissoes.rows[0].leitura, false); assert.equal(permissoes.rows[0].escrita, false);
    await db.query("insert into aulas values ($1)", [aulaId]);
    await db.query("insert into aula_quizzes(aula_id,rascunho) values ($1,$2)", [aulaId, JSON.stringify(perguntas)]);
    assert.equal((await db.query<{ publicado: boolean }>("select publicado from aula_quizzes")).rows[0].publicado, false);
    await db.query("update aula_quizzes set perguntas=rascunho,publicado=true where aula_id=$1", [aulaId]);
    await db.query("update aula_quizzes set rascunho='[]' where aula_id=$1", [aulaId]);
    assert.equal((await db.query<{ n: number }>("select jsonb_array_length(perguntas) as n from aula_quizzes")).rows[0].n, 3);
    await assert.rejects(db.exec("update aula_quizzes set perguntas='[]'"));
  } finally { await db.close(); }
});


function geradorIA(perguntasGeradas: unknown[], stopReason = "end_turn") {
  let pedido: Record<string, unknown> | null = null;
  const deps: Record<string, unknown> = {
    "server-only": {}, "node:crypto": { randomUUID },
    "@anthropic-ai/sdk/helpers/zod": { zodOutputFormat: () => ({ type: "json_schema" }) },
    "@/lib/questoes/ia": { MODELO: "modelo-configurado", clienteIA: () => ({ messages: { parse: async (dados: Record<string, unknown>) => { pedido = dados; return { stop_reason: stopReason, parsed_output: { perguntas: perguntasGeradas } }; } } }) },
    "./quiz": quiz,
  };
  const exports: { gerarRascunhoQuiz: (titulo: string, pedido: quiz.PedidoQuizIA) => Promise<quiz.PerguntaQuiz[]> } = {} as never;
  const js = transpileModule(readFileSync("src/lib/aulas/quiz-ia.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports, process: { env: {} }, require: (nome: string) => { if (!(nome in deps)) throw Error(nome); return deps[nome]; } });
  return { gerar: exports.gerarRascunhoQuiz, pedido: () => pedido };
}
test("quiz IA: usa texto fornecido, formato estruturado e valida o rascunho", async () => {
  const a = geradorIA(perguntas.map(p => ({ enunciado: p.enunciado, alternativas: p.alternativas, correta: p.correta, explicacao: p.explicacao })));
  const resultado = await a.gerar("Leis de Newton", { fonte: "Transcricao da aula", quantidade: 3, dificuldade: "media" });
  assert.equal(resultado.length, 3); assert.ok(resultado.every(p => zod.z.uuid().safeParse(p.id).success));
  assert.ok(JSON.stringify(a.pedido()).includes("Transcricao da aula")); assert.ok(JSON.stringify(a.pedido()).includes("json_schema"));
});
test("quiz IA: recusa conteudo insuficiente, resposta truncada ou quantidade errada", async () => {
  const pedido = { fonte: "Transcricao da aula", quantidade: 3, dificuldade: "media" } as const;
  await assert.rejects(geradorIA([]).gerar("Aula", pedido));
  await assert.rejects(geradorIA(perguntas, "max_tokens").gerar("Aula", pedido));
  await assert.rejects(geradorIA(perguntas.slice(0, 2)).gerar("Aula", pedido));
});
