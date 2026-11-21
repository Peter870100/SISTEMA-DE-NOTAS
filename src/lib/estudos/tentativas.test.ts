import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("novas tentativas preservam a primeira resposta e ficam protegidas por RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table alunos_contas(id uuid primary key); create table exercicios_fixacao(id uuid primary key); create table respostas_fixacao(conta_id uuid, exercicio_id uuid, marcada char(1), primary key(conta_id, exercicio_id));`);
    await db.exec(readFileSync("db/2026-11-21-refazer-fixacao.sql", "utf8"));
    await db.exec(`insert into alunos_contas values ('00000000-0000-4000-8000-000000000001'); insert into exercicios_fixacao values ('00000000-0000-4000-8000-000000000002'); insert into respostas_fixacao values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','A'); insert into respostas_fixacao_tentativas(conta_id,exercicio_id,tentativa_id,marcada,acertou) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','B',true);`);
    const original = await db.query<{ marcada: string }>("select marcada from respostas_fixacao");
    const nova = await db.query<{ marcada: string }>("select marcada from respostas_fixacao_tentativas");
    assert.equal(original.rows[0].marcada, "A");
    assert.equal(nova.rows[0].marcada, "B");
    const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname = 'respostas_fixacao_tentativas'");
    assert.equal(rls.rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
