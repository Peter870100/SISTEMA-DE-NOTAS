import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDoLogin, escolaDoHost, urlDaEscola, validarSubdominio } from "./dominio";

test("escolaDoHost: Status nos endereços dele, testes e previews", () => {
  for (const h of ["www.statusavalia.com.br", "statusavalia.com.br", "status.statusavalia.com.br", "WWW.StatusAvalia.com.br:443", "sistema-de-notas.vercel.app", "localhost:3000", "127.0.0.1", "statusavalia.com.br."]) {
    assert.equal(escolaDoHost(h), "status", h);
  }
  assert.equal(escolaDoHost(null), "status");
});

test("escolaDoHost: subdomínio vira slug; o resto é desconhecido", () => {
  assert.equal(escolaDoHost("colegiox.statusavalia.com.br"), "colegiox");
  assert.equal(escolaDoHost("Colegio-X.statusavalia.com.br"), "colegio-x");
  assert.equal(escolaDoHost("a.b.statusavalia.com.br"), null);
  assert.equal(escolaDoHost("statusavalia.com.br.evil.com"), null);
  assert.equal(escolaDoHost("outrosite.com"), null);
});

test("urlDaEscola", () => {
  assert.equal(urlDaEscola("status", "/login"), "https://www.statusavalia.com.br/login");
  assert.equal(urlDaEscola("colegiox", "redefinir-senha?token=1"), "https://colegiox.statusavalia.com.br/redefinir-senha?token=1");
});

test("validarSubdominio", () => {
  assert.equal(validarSubdominio("colegiox"), null);
  assert.equal(validarSubdominio("colegio-x2"), null);
  assert.notEqual(validarSubdominio("ab"), null);
  assert.notEqual(validarSubdominio("-colegio"), null);
  assert.notEqual(validarSubdominio("colegio-"), null);
  assert.notEqual(validarSubdominio("Colegio"), null);
  assert.notEqual(validarSubdominio("colégio"), null);
  assert.notEqual(validarSubdominio("a".repeat(31)), null);
  assert.notEqual(validarSubdominio("www"), null);
  assert.notEqual(validarSubdominio("status"), null);
});

test("destinoDoLogin", () => {
  assert.deepEqual(destinoDoLogin("status", "status"), { ok: true });
  assert.deepEqual(destinoDoLogin("colegiox", "status"), { ok: false, slug: "colegiox" });
  assert.deepEqual(destinoDoLogin("status", "colegiox"), { ok: false, slug: "status" });
  assert.deepEqual(destinoDoLogin("status", null), { ok: false, slug: "status" });
});
