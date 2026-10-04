import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { contaDoToken, gerarTokenRedefinicao, validarTokenRedefinicao } from "./token-senha";

const ID = "3f1c2a9e-0000-4000-8000-000000000001";
const HASH = "$2a$10$hashatualdasenha";
const SEGREDO = "segredo-de-teste";
const AGORA = 1_800_000_000_000;

test("token recém-gerado é válido e devolve o id do professor", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA);
  assert.deepEqual(validarTokenRedefinicao(token, HASH, SEGREDO, AGORA + 1000), { tipo: "p", id: ID });
});

test("token expira depois de 1 hora", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA);
  assert.deepEqual(validarTokenRedefinicao(token, HASH, SEGREDO, AGORA + 59 * 60_000), { tipo: "p", id: ID });
  assert.equal(validarTokenRedefinicao(token, HASH, SEGREDO, AGORA + 61 * 60_000), null);
});

test("token deixa de valer depois que a senha muda (uso único)", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA);
  assert.equal(validarTokenRedefinicao(token, "$2a$10$outrohash", SEGREDO, AGORA), null);
});

test("token adulterado, com outro segredo ou malformado é rejeitado", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA);
  const [id, expira, assinatura] = token.split(".");
  assert.equal(validarTokenRedefinicao(`${id}.${Number(expira) + 999_999}.${assinatura}`, HASH, SEGREDO, AGORA), null);
  assert.equal(validarTokenRedefinicao(token, HASH, "outro-segredo", AGORA), null);
  assert.equal(validarTokenRedefinicao("lixo", HASH, SEGREDO, AGORA), null);
  assert.equal(validarTokenRedefinicao("", HASH, SEGREDO, AGORA), null);
  assert.equal(validarTokenRedefinicao(token, null, SEGREDO, AGORA), null);
});

test("contaDoToken extrai tipo e id sem validar, e devolve null pra lixo", () => {
  assert.deepEqual(contaDoToken(gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA)), { tipo: "p", id: ID });
  assert.deepEqual(contaDoToken(gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA, "a")), { tipo: "a", id: ID });
  assert.equal(contaDoToken("lixo"), null);
  assert.equal(contaDoToken(undefined), null);
});

test("token de aluno valida como aluno e não vira professor se trocar o prefixo", () => {
  const token = gerarTokenRedefinicao(ID, HASH, SEGREDO, AGORA, "a");
  assert.deepEqual(validarTokenRedefinicao(token, HASH, SEGREDO, AGORA), { tipo: "a", id: ID });
  assert.equal(validarTokenRedefinicao(token.replace(/^a~/, ""), HASH, SEGREDO, AGORA), null);
});

test("token legado (gerado antes do tipo existir) continua valendo como professor", () => {
  // formato antigo: id.expira.assinatura, assinatura sobre `redefinir:id:expira:hash`
  const expira = AGORA + 60_000;
  const assinatura = createHmac("sha256", SEGREDO).update(`redefinir:${ID}:${expira}:${HASH}`).digest("hex");
  assert.deepEqual(validarTokenRedefinicao(`${ID}.${expira}.${assinatura}`, HASH, SEGREDO, AGORA), { tipo: "p", id: ID });
});
