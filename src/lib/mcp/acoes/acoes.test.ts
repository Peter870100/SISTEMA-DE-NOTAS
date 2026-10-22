import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Escopo } from "../escopo";
import type { Ctx } from "../leitura/comum";
import { atorDoEscopo, ERRO_QUESTAO, ERRO_SIMULADO, escolherEscola, paraIsoSaoPaulo, resolverTurmas } from "./ator";

const professor: Escopo = { tipo: "professor", escolaId: "e1", professorId: "p1", turmas: null, papel: "professor" };

/** Banco falso: só responde à busca do professor com role 'dono'. */
function bancoDono(linhas: { id: string; escola_id: string }[]): SupabaseClient {
  const consulta = { select: () => consulta, eq: () => consulta, limit: async () => ({ data: linhas, error: null }) };
  return { from: () => consulta } as unknown as SupabaseClient;
}
const ctx = (escopo: Escopo, supabase = bancoDono([])): Ctx => ({ supabase, escopo });

test("atorDoEscopo: professor de outra escola é recusado", async () => {
  await assert.rejects(atorDoEscopo(ctx(professor), "e2"), /Você só pode mexer na sua escola\./);
});

test("atorDoEscopo: registro de outra escola citado por id usa a mensagem da tela", async () => {
  assert.equal(ERRO_SIMULADO, "Simulado não encontrado.");
  assert.equal(ERRO_QUESTAO, "Você não pode editar essa questão.");
  await assert.rejects(atorDoEscopo(ctx(professor), "e2", ERRO_SIMULADO), (e: Error) => e.message === "Simulado não encontrado.");
  await assert.rejects(atorDoEscopo(ctx(professor), "e2", ERRO_QUESTAO), (e: Error) => e.message === "Você não pode editar essa questão.");
  // na própria escola a mensagem não importa
  assert.equal((await atorDoEscopo(ctx(professor), "e1", ERRO_SIMULADO)).escola_id, "e1");
});

test("atorDoEscopo: professor da escola recebe as turmas dele e via hermes", async () => {
  const restrito: Escopo = { ...professor, turmas: new Set(["1A"]) };
  const ator = await atorDoEscopo(ctx(restrito), "e1");
  assert.deepEqual(ator, { id: "p1", role: "professor", escola_id: "e1", turmas: new Set(["1A"]), via: "hermes" });
});

test("atorDoEscopo: papel ausente conta como professor comum", async () => {
  const { papel: _p, ...semPapel } = professor as Extract<Escopo, { tipo: "professor" }>;
  void _p;
  assert.equal((await atorDoEscopo(ctx(semPapel), "e1")).role, "professor");
});

test("atorDoEscopo: dono age na escola do pedido, sem limite de turmas", async () => {
  const ator = await atorDoEscopo(ctx({ tipo: "dono" }, bancoDono([{ id: "d1", escola_id: "e9" }])), "e2");
  assert.deepEqual(ator, { id: "d1", role: "dono", escola_id: "e2", turmas: null, via: "hermes" });
});

test("atorDoEscopo: sem exatamente um dono cadastrado, falha claro", async () => {
  await assert.rejects(atorDoEscopo(ctx({ tipo: "dono" }), "e2"), /conta de dono/);
  const dois = bancoDono([{ id: "d1", escola_id: "e1" }, { id: "d2", escola_id: "e1" }]);
  await assert.rejects(atorDoEscopo(ctx({ tipo: "dono" }, dois), "e2"), /conta de dono/);
});

const escolas = [
  { id: "e1", nome: "Colégio Status", slug: "status" },
  { id: "e2", nome: "Escola Teste", slug: "teste" },
];

test("escolherEscola: dono com 2 escolas e sem nome pede a escola listando as duas", () => {
  assert.throws(() => escolherEscola(escolas), { message: "Diga em qual escola: Colégio Status, Escola Teste." });
  assert.throws(() => escolherEscola(escolas, "  "), { message: "Diga em qual escola: Colégio Status, Escola Teste." });
});

test("escolherEscola: nome ou slug que casa uma escola devolve ela", () => {
  assert.equal(escolherEscola(escolas, "escola teste").id, "e2");
  assert.equal(escolherEscola(escolas, "status").id, "e1");
  assert.equal(escolherEscola(escolas, "Colegio").id, "e1");
});

test("escolherEscola: uma escola só dispensa o nome; nome desconhecido lista as escolas", () => {
  assert.equal(escolherEscola([escolas[0]]).id, "e1");
  assert.throws(() => escolherEscola(escolas, "Outra"), /Escola "Outra" não encontrada\. Escolas: Colégio Status, Escola Teste\./);
});

test("escolherEscola: nome que casa mais de uma pede para escolher", () => {
  assert.equal(escolherEscola(escolas, "escola").id, "e2");
  assert.throws(() => escolherEscola([...escolas, { id: "e3", nome: "Escola Nova", slug: "nova" }], "escola"), { message: "Diga em qual escola: Escola Teste, Escola Nova." });
});

test("paraIsoSaoPaulo: dd/mm/aaaa hh:mm é horário de São Paulo (UTC-3)", () => {
  assert.equal(paraIsoSaoPaulo("25/10/2026 08:00"), "2026-10-25T11:00:00.000Z");
  assert.equal(paraIsoSaoPaulo("5/1/2027 23:30"), "2027-01-06T02:30:00.000Z");
});

test("paraIsoSaoPaulo: ISO com fuso passa igual; ISO sem fuso vale São Paulo", () => {
  assert.equal(paraIsoSaoPaulo("2026-10-25T11:00:00.000Z"), "2026-10-25T11:00:00.000Z");
  assert.equal(paraIsoSaoPaulo("2026-10-25T08:00:00-03:00"), "2026-10-25T11:00:00.000Z");
  assert.equal(paraIsoSaoPaulo("2026-10-25T08:00"), "2026-10-25T11:00:00.000Z");
});

test("paraIsoSaoPaulo: data inválida é recusada", () => {
  assert.throws(() => paraIsoSaoPaulo("31/02/2026 08:00"), /Data inválida/);
  assert.throws(() => paraIsoSaoPaulo("amanhã"), /Data inválida/);
  assert.throws(() => paraIsoSaoPaulo("25/10/2026 25:00"), /Data inválida/);
});

const turmasEscola = [
  { nome: "1ª série A", ano_letivo: "2025" },
  { nome: "1ª série A", ano_letivo: "2026" },
  { nome: "2ª série B", ano_letivo: "2026" },
];

test("resolverTurmas: usa o ano letivo mais recente de cada turma", () => {
  assert.deepEqual(resolverTurmas(["1ª série a", "2ª SÉRIE B"], turmasEscola, null), [
    { turma_nome: "1ª série A", ano_letivo: "2026" },
    { turma_nome: "2ª série B", ano_letivo: "2026" },
  ]);
});

test("resolverTurmas: nome inexistente lista as turmas da escola", () => {
  assert.throws(() => resolverTurmas(["3ª série C"], turmasEscola, null), {
    message: 'Turma não encontrada: "3ª série C". Turmas da escola: 1ª série A, 2ª série B.',
  });
});

test("resolverTurmas: professor restrito não usa turma não liberada", () => {
  assert.throws(() => resolverTurmas(["2ª série B"], turmasEscola, new Set(["1ª série A"])), /Você não tem acesso à turma 2ª série B\./);
  assert.deepEqual(resolverTurmas(["1ª série A"], turmasEscola, new Set(["1ª série A"])), [{ turma_nome: "1ª série A", ano_letivo: "2026" }]);
});
