import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinarSessao, verificarSessao } from "./sessao";

const ID = "3f1c2a9e-0000-4000-8000-000000000001";
const CHAVE = "segredo-de-teste";

test("assina e valida sessão de professor e de aluno", () => {
  assert.deepEqual(verificarSessao(assinarSessao("p", ID, CHAVE), CHAVE), { tipo: "p", id: ID });
  assert.deepEqual(verificarSessao(assinarSessao("a", ID, CHAVE), CHAVE), { tipo: "a", id: ID });
});

test("trocar 'a' por 'p' no cookie invalida a assinatura", () => {
  const cookieAluno = assinarSessao("a", ID, CHAVE);
  assert.equal(verificarSessao(cookieAluno.replace(/^a:/, "p:"), CHAVE), null);
});

test("cookie legado (sem tipo) é lido como professor", () => {
  const assinatura = createHmac("sha256", CHAVE).update(ID).digest("hex");
  assert.deepEqual(verificarSessao(`${ID}.${assinatura}`, CHAVE), { tipo: "p", id: ID });
});

test("rejeita adulterado, outra chave, tipo desconhecido e lixo", () => {
  const cookie = assinarSessao("p", ID, CHAVE);
  assert.equal(verificarSessao(cookie.slice(0, -1) + "0", CHAVE), null);
  assert.equal(verificarSessao(cookie, "outra-chave"), null);
  const assinaturaX = createHmac("sha256", CHAVE).update(`x:${ID}`).digest("hex");
  assert.equal(verificarSessao(`x:${ID}.${assinaturaX}`, CHAVE), null);
  assert.equal(verificarSessao("lixo", CHAVE), null);
  assert.equal(verificarSessao(undefined, CHAVE), null);
  assert.equal(verificarSessao("", CHAVE), null);
});
