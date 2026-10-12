import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as avatar from "./avatar-aluno";

function acao({ logado = true, erro = null, semLinha = false }: { logado?: boolean; erro?: { code: string } | null; semLinha?: boolean } = {}) {
  const chamadas: unknown[] = [];
  const consulta = {
    update: (valor: unknown) => { chamadas.push(valor); return consulta; },
    eq: (campo: string, valor: string) => { chamadas.push([campo, valor]); return consulta; },
    select: () => consulta,
    single: async () => ({ data: semLinha ? null : { avatar_perfil: (chamadas[0] as { avatar_perfil: string | null }).avatar_perfil }, error: erro }),
  };
  const deps: Record<string, unknown> = {
    "@/lib/auth": { getAlunoAtual: async () => logado ? { id: "aluno-autenticado", escola_id: "escola-autenticada" } : null },
    "@/lib/avatar-aluno": avatar,
    "@/lib/supabase/client": { supabase: { from: () => consulta } },
    "next/cache": { revalidatePath: (...args: string[]) => chamadas.push(args) },
  };
  const exports: { salvarAvatarAluno?: (valor: unknown) => Promise<{ erro?: string; avatar?: string }> } = {};
  const js = transpileModule(readFileSync("src/actions/perfil-aluno.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports, Buffer, require: (nome: string) => { if (!(nome in deps)) throw Error(nome); return deps[nome]; } });
  return { executar: exports.salvarAvatarAluno!, chamadas };
}

test("avatar: bloqueia visitante sem gravar", async () => {
  const a = acao({ logado: false }); assert.ok((await a.executar(avatar.EMOJIS_ALUNO[0])).erro); assert.equal(a.chamadas.length, 0);
});
test("avatar: rejeita URL externa, SVG, payload enorme e entrada invalida", async () => {
  for (const valor of [null, {}, "https://example.com/a.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "x".repeat(400001), "data:image/jpeg;base64,/9j/AAAA"]) {
    const a = acao(); assert.ok((await a.executar(valor)).erro); assert.equal(a.chamadas.length, 0);
  }
});
test("avatar: salva emoji somente na conta e escola autenticadas", async () => {
  const a = acao(); const valor = avatar.EMOJIS_ALUNO[0]; assert.equal((await a.executar(valor)).avatar, valor);
  assert.equal(JSON.stringify(a.chamadas), JSON.stringify([{ avatar_perfil: valor }, ["id", "aluno-autenticado"], ["escola_id", "escola-autenticada"], ["/aluno", "layout"]]));
});
test("avatar: aceita JPEG e permite remover", async () => {
  const foto = "data:image/jpeg;base64," + Buffer.from([255, 216, 255, 224, 0, 255, 217]).toString("base64");
  assert.equal((await acao().executar(foto)).avatar, foto);
  const a = acao(); assert.equal((await a.executar("")).avatar, ""); assert.equal((a.chamadas[0] as { avatar_perfil: null }).avatar_perfil, null);
});
test("avatar: falha de banco ou linha ausente nunca confirma salvamento", async () => {
  for (const cenario of [{ erro: { code: "PGRST204" } }, { erro: { code: "network" } }, { semLinha: true }]) {
    const a = acao(cenario); const retorno = await a.executar(avatar.EMOJIS_ALUNO[0]); assert.ok(retorno.erro); assert.equal(retorno.avatar, undefined); assert.equal(a.chamadas.length, 3);
  }
});
test("avatar: migracao idempotente preserva conta e persiste foto/emoji entre consultas", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table alunos_contas(id text primary key,nome text);insert into alunos_contas values ('a','Aluno');");
    const sql = readFileSync("db/2026-10-11-avatar-aluno.sql", "utf8"); await db.exec(sql); await db.exec(sql);
    await db.query("update alunos_contas set avatar_perfil=$1 where id='a'", [avatar.EMOJIS_ALUNO[0]]);
    assert.equal((await db.query<{ avatar_perfil: string }>("select avatar_perfil from alunos_contas where id='a'")).rows[0].avatar_perfil, avatar.EMOJIS_ALUNO[0]);
    const foto = "data:image/jpeg;base64," + Buffer.from([255, 216, 255, 224, 0, 255, 217]).toString("base64");
    await db.query("update alunos_contas set avatar_perfil=$1 where id='a'", [foto]);
    assert.equal((await db.query<{ avatar_perfil: string }>("select avatar_perfil from alunos_contas where id='a'")).rows[0].avatar_perfil, foto);
    await assert.rejects(db.query("update alunos_contas set avatar_perfil=$1 where id='a'", ["x".repeat(400000)]));
    assert.equal((await db.query<{ nome: string }>("select nome from alunos_contas where id='a'")).rows[0].nome, "Aluno");
  } finally { await db.close(); }
});


test("recorte: centraliza fotos horizontais e verticais", async () => {
  const { areaRecorte } = await import("./recorte-avatar");
  assert.deepEqual(areaRecorte(1200, 600, 1, 50, 50), { x: 300, y: 0, lado: 600 });
  assert.deepEqual(areaRecorte(600, 1200, 1, 50, 50), { x: 0, y: 300, lado: 600 });
});
test("recorte: zoom e posicao permanecem dentro da imagem", async () => {
  const { areaRecorte } = await import("./recorte-avatar");
  for (const [w, h] of [[1200, 600], [600, 1200], [256, 256]]) {
    for (const zoom of [-1, 1, 2, 3, 100]) for (const posicao of [-100, 0, 50, 100, 200]) {
      const area = areaRecorte(w, h, zoom, posicao, posicao);
      assert.ok(area.x >= 0 && area.y >= 0 && area.lado > 0);
      assert.ok(area.x + area.lado <= w && area.y + area.lado <= h);
    }
  }
});
