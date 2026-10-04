import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDaRota, ehRotaPublica } from "./rotas";

const P = { tipo: "p" as const, id: "1" };
const A = { tipo: "a" as const, id: "2" };

test("rotas públicas passam para qualquer um", () => {
  for (const r of ["/login", "/cadastro", "/verificar-email", "/esqueci-senha", "/redefinir-senha", "/api/mcp", "/aluno/entrar-com-codigo", "/logo.png"]) {
    assert.equal(ehRotaPublica(r), true, r);
    assert.equal(destinoDaRota(r, null), "seguir", r);
  }
});

test("sem sessão em rota protegida vai para /login", () => {
  assert.equal(destinoDaRota("/", null), "/login");
  assert.equal(destinoDaRota("/aluno", null), "/login");
});

test("aluno só abre /aluno/*", () => {
  assert.equal(destinoDaRota("/aluno", A), "seguir");
  assert.equal(destinoDaRota("/aluno/trocar-senha", A), "seguir");
  assert.equal(destinoDaRota("/", A), "/aluno");
  assert.equal(destinoDaRota("/admin/professores", A), "/aluno");
  assert.equal(destinoDaRota("/turma/abc", A), "/aluno");
});

test("professor não abre /aluno/*, exceto a página pública de código", () => {
  assert.equal(destinoDaRota("/", P), "seguir");
  assert.equal(destinoDaRota("/aluno", P), "/");
  assert.equal(destinoDaRota("/alunos-qualquer", P), "seguir");
  assert.equal(destinoDaRota("/aluno/entrar-com-codigo", P), "seguir");
});
