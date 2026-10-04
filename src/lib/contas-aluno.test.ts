import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehEmail,
  formatarCodigo,
  gerarCodigoConvite,
  gerarSenhaProvisoria,
  normalizarCodigo,
  normalizarIdentificador,
  sugerirUsuario,
} from "./contas-aluno";

test("usuário sugerido: primeiro nome + último sobrenome, sem acento, minúsculo", () => {
  assert.equal(sugerirUsuario("João da Silva", new Set()), "joao.silva");
  assert.equal(sugerirUsuario("  MARIA   Conceição dos Santos ", new Set()), "maria.santos");
  assert.equal(sugerirUsuario("Ândria Lú", new Set()), "andria.lu");
});

test("usuário sugerido: nome de uma palavra e caracteres estranhos", () => {
  assert.equal(sugerirUsuario("Pelé", new Set()), "pele");
  assert.equal(sugerirUsuario("Ana-Clara O'Neil", new Set()), "anaclara.oneil");
});

test("usuário sugerido: repetido ganha sufixo e entra no conjunto (lote com nomes iguais)", () => {
  const existentes = new Set(["joao.silva"]);
  assert.equal(sugerirUsuario("João Silva", existentes), "joao.silva2");
  assert.equal(sugerirUsuario("Joao Silva", existentes), "joao.silva3");
  const lote = new Set<string>();
  assert.equal(sugerirUsuario("Ana Souza", lote), "ana.souza");
  assert.equal(sugerirUsuario("Ana Souza", lote), "ana.souza2");
});

test("usuário sugerido: nome vazio vira 'aluno'", () => {
  assert.equal(sugerirUsuario("   ", new Set()), "aluno");
});

test("senha provisória: 8 caracteres do alfabeto sem ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    const senha = gerarSenhaProvisoria();
    assert.match(senha, /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  }
});

test("código de convite: 6 caracteres maiúsculos sem ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(gerarCodigoConvite(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test("código de convite: normaliza minúsculas, hífen e espaços", () => {
  assert.equal(normalizarCodigo("k7p-4qx"), "K7P4QX");
  assert.equal(normalizarCodigo(" k7p 4qx "), "K7P4QX");
  assert.equal(normalizarCodigo("K7P4QX"), "K7P4QX");
  assert.equal(formatarCodigo("K7P4QX"), "K7P-4QX");
});

test("identificador do login: trim + minúsculas; com @ é email", () => {
  assert.equal(normalizarIdentificador("  Joao@X.com "), "joao@x.com");
  assert.equal(normalizarIdentificador(" Joao.Silva "), "joao.silva");
  assert.equal(ehEmail("joao@x.com"), true);
  assert.equal(ehEmail("joao.silva"), false);
});
