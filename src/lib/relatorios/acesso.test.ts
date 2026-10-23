import { test } from "node:test";
import assert from "node:assert/strict";
import type { Escopo } from "@/lib/mcp/escopo";
import { grupoDaTurma, podeVerGrupo } from "./acesso";

const grupo = grupoDaTurma({ escola_id: "esc-1", nome: "3º A", ano_letivo: "2026" });
const professor = (turmas: Set<string> | null, escolaId = "esc-1"): Escopo => ({ tipo: "professor", escolaId, professorId: "p1", turmas });

test("grupoDaTurma monta o grupo escola + nome + ano", () => {
  assert.deepEqual(grupo, { escolaId: "esc-1", nome: "3º A", anoLetivo: "2026" });
});

test("dono ve qualquer grupo", () => {
  assert.equal(podeVerGrupo({ tipo: "dono" }, grupo), true);
});

test("professor de outra escola nao ve", () => {
  assert.equal(podeVerGrupo(professor(null, "esc-2"), grupo), false);
});

test("professor restrito sem a turma liberada nao ve", () => {
  assert.equal(podeVerGrupo(professor(new Set(["3º B"])), grupo), false);
  assert.equal(podeVerGrupo(professor(new Set()), grupo), false);
});

test("professor restrito com a turma liberada ve", () => {
  assert.equal(podeVerGrupo(professor(new Set(["3º B", "3º A"])), grupo), true);
});

test("professor sem restricao (turmas null) ve as turmas da escola", () => {
  assert.equal(podeVerGrupo(professor(null), grupo), true);
});
