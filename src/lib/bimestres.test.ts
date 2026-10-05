import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("controle de bimestres protege os dados no PostgreSQL", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table turmas (id uuid primary key, escola_id uuid not null, nome text not null, ano_letivo text not null, bimestre text not null);
      create table alunos (id uuid primary key, turma_id uuid references turmas(id) on delete cascade, nome text not null);
      create table atividades_colunas (id uuid primary key, turma_id uuid references turmas(id) on delete cascade, titulo text not null, tipo text not null default 'nota');
      create table notas_celulas (id uuid primary key default gen_random_uuid(), aluno_id uuid references alunos(id) on delete cascade, coluna_id uuid references atividades_colunas(id) on delete cascade, valor numeric, status_texto text, unique(aluno_id, coluna_id));
    `);
    const migration = readFileSync("db/2026-10-04-controle-bimestres.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration); // reexecução segura
    for (let n = 1; n <= 5; n++) {
      await db.query("insert into turmas values ($1,$2,$3,$4,$5,false,false)", [id(n), id(n === 5 ? 101 : 100), n === 3 ? "Turma B" : "Turma A", n === 4 ? "2027" : "2026", n === 2 ? "3º Bimestre" : "2º Bimestre"]);
      await db.query("insert into alunos values ($1,$2,'Aluno')", [id(n + 10), id(n)]);
      await db.query("insert into atividades_colunas values ($1,$2,'Atividade','nota')", [id(n + 20), id(n)]);
      await db.query("insert into notas_celulas (aluno_id,coluna_id,valor) values ($1,$2,600)", [id(n + 10), id(n + 20)]);
    }
    const alterar = (n: number, acao: string) => db.query("select * from alterar_situacao_bimestre($1,$2)", [id(n), acao]);
    const consulta = (n: number) => db.query<{ bimestre_encerrado: boolean; bimestre_vigente: boolean }>("select bimestre_encerrado,bimestre_vigente from turmas where id=$1", [id(n)]);
    const caso = async (nome: string, executar: () => Promise<void>) => t.test(nome, async () => {
      await db.exec("begin");
      try { await executar(); } finally { await db.exec("rollback"); }
    });
    await caso("troca a vigência sem afetar outra turma, ano ou escola", async () => {
      for (const n of [1,3,4,5]) await alterar(n, "ativar");
      await alterar(2, "ativar");
      assert.equal((await consulta(1)).rows[0].bimestre_vigente, false);
      for (const n of [2,3,4,5]) assert.equal((await consulta(n)).rows[0].bimestre_vigente, true);
    });
    await caso("encerrar retira vigência e reabrir preserva notas sem trocar o período ativo", async () => {
      await alterar(1, "ativar");
      await alterar(1, "encerrar");
      assert.deepEqual((await consulta(1)).rows[0], { bimestre_encerrado: true, bimestre_vigente: false });
      const notas = await db.query<{ valor: string }>("select valor from notas_celulas where aluno_id=$1", [id(11)]);
      assert.equal(Number(notas.rows[0].valor), 600);
      await alterar(2, "ativar");
      await alterar(1, "reabrir");
      assert.deepEqual((await consulta(1)).rows[0], { bimestre_encerrado: false, bimestre_vigente: false });
      assert.equal((await consulta(2)).rows[0].bimestre_vigente, true);
      await db.query("update notas_celulas set valor=800 where aluno_id=$1", [id(11)]);
    });
    for (const sql of [
      "update notas_celulas set valor=900 where aluno_id=$1",
      "delete from notas_celulas where aluno_id=$1",
      "insert into notas_celulas (aluno_id,coluna_id,valor) values ($1,$2,900) on conflict (aluno_id,coluna_id) do update set valor=excluded.valor",
      "update notas_celulas set status_texto='F',valor=null where aluno_id=$1",
      "update notas_celulas set aluno_id='00000000-0000-4000-8000-000000000012',coluna_id='00000000-0000-4000-8000-000000000022' where aluno_id=$1",
    ]) await caso("bloqueia lançamento direto: " + sql.split(" ")[0], async () => {
      await alterar(1, "encerrar");
      await assert.rejects(db.query(sql, sql.includes("$2") ? [id(11), id(21)] : [id(11)]), /Bimestre encerrado/);
    });
    for (const sql of [
      "delete from alunos where turma_id=$1",
      "update alunos set turma_id='00000000-0000-4000-8000-000000000002' where turma_id=$1",
      "insert into alunos values ('00000000-0000-4000-8000-000000000099',$1,'Novo')",
      "delete from atividades_colunas where turma_id=$1",
      "update atividades_colunas set titulo='Alterado' where turma_id=$1",
      "insert into atividades_colunas values ('00000000-0000-4000-8000-000000000099',$1,'Nova','presenca')",
    ]) await caso("protege estrutura: " + sql, async () => {
      await alterar(1, "encerrar");
      await assert.rejects(db.query(sql, [id(1)]), /Bimestre encerrado/);
    });
    await caso("não permite ativar encerrado", async () => {
      await alterar(1, "encerrar");
      await assert.rejects(alterar(1, "ativar"), /Reabra/);
    });
    await caso("não mistura aluno e atividade de períodos diferentes", async () => {
      await assert.rejects(db.query("insert into notas_celulas (aluno_id,coluna_id,valor) values ($1,$2,700)", [id(11),id(22)]), /mesmo bimestre/);
    });
    await caso("índice rejeita dois vigentes da mesma turma", async () => {
      await alterar(1, "ativar");
      await assert.rejects(db.query("update turmas set bimestre_vigente=true where id=$1", [id(2)]), /unique constraint/);
    });
    await caso("impede excluir arquivo encerrado", async () => { await alterar(1, "encerrar"); await assert.rejects(db.query("delete from turmas where id=$1", [id(1)]), /Bimestre encerrado/); });
    await caso("preserva exclusões em cascata de bimestres abertos", async () => { await db.query("delete from turmas where id=$1", [id(1)]); assert.equal((await consulta(1)).rows.length, 0); });
    await caso("rejeita ação inválida", async () => { await assert.rejects(alterar(1, "excluir"), /inválida/); });
  } finally { await db.close(); }
});
