import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import * as zod from "zod";

const turmaId = "00000000-0000-4000-8000-000000000001";
const turma = { id: turmaId, nome: "1ª série A", escola_id: "escola-1" };
const professor = { id: "professor-1", escola_id: "escola-1" };

function acao(cenario: { professor?: typeof professor | null; turma?: typeof turma | null; acesso?: boolean; erro?: { code: string; message: string } }) {
  const chamadas: string[] = [];
  const exports: { alterarBimestre?: (id: string, acao: string) => Promise<void> } = {};
  const consulta = { select: () => consulta, eq: () => consulta, single: async () => ({ data: cenario.turma === undefined ? turma : cenario.turma, error: null }) };
  const dependencias: Record<string, unknown> = {
    "zod": zod,
    "next/cache": { revalidatePath: (p: string) => chamadas.push("revalidar:" + p) },
    "@/lib/auth": { getProfessorAtual: async () => cenario.professor === undefined ? professor : cenario.professor, professorTemAcessoATurma: async () => cenario.acesso ?? true },
    "@/lib/supabase/client": { supabase: { from: () => consulta, rpc: async (_nome: string, args: { p_acao: string }) => { chamadas.push(args.p_acao); return { data: [turma], error: cenario.erro ?? null }; } } },
  };
  const source = transpileModule(readFileSync("src/actions/bimestres.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, require: (nome: string) => { if (!(nome in dependencias)) throw new Error(nome); return dependencias[nome]; } });
  return { executar: exports.alterarBimestre!, chamadas };
}

test("gerenciar bimestre exige professor autenticado", async () => { const a = acao({ professor: null }); await assert.rejects(a.executar(turmaId,"encerrar"), /professor/); assert.deepEqual(a.chamadas, []); });
test("gerenciar bimestre exige acesso à turma", async () => { const a = acao({ acesso: false }); await assert.rejects(a.executar(turmaId,"encerrar"), /acesso/); assert.deepEqual(a.chamadas, []); });
test("não gerencia bimestre de outra escola", async () => { const a = acao({ turma: { ...turma, escola_id: "outra" } }); await assert.rejects(a.executar(turmaId,"reabrir"), /acesso/); assert.deepEqual(a.chamadas, []); });
test("não gerencia turma inexistente", async () => { const a = acao({ turma: null }); await assert.rejects(a.executar(turmaId,"ativar"), /encontrada/); assert.deepEqual(a.chamadas, []); });
for (const operacao of ["encerrar", "reabrir", "ativar"]) test("ação " + operacao + " revalida lista e turma", async () => { const a = acao({}); await a.executar(turmaId,operacao); assert.deepEqual(a.chamadas, [operacao,"revalidar:/","revalidar:/turma/" + turmaId]); });
test("identificador inválido não chama banco", async () => { const a=acao({}); await assert.rejects(a.executar("invalido","encerrar")); assert.deepEqual(a.chamadas,[]); });
test("ação inválida não chama banco", async () => { const a=acao({}); await assert.rejects(a.executar(turmaId,"excluir")); assert.deepEqual(a.chamadas,[]); });
test("informa quando a migração não está instalada", async () => { const a=acao({ erro: { code:"PGRST202",message:"missing" } }); await assert.rejects(a.executar(turmaId,"encerrar"), /ativado no banco/); assert.deepEqual(a.chamadas,["encerrar"]); });
