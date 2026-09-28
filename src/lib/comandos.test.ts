import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarComandos, normalizar, trechosDestacados, type ItemComando } from "./comandos";

const item = (id: string, rotulo: string, palavrasChave?: string[]): ItemComando => ({
  id,
  grupo: "Ações",
  rotulo,
  palavrasChave,
  executar: () => {},
});

test("normalizar remove acento e caixa", () => {
  assert.equal(normalizar("José ÁVILA"), "jose avila");
});

test("filtrarComandos com termo vazio devolve todos na ordem", () => {
  const itens = [item("a", "Exportar"), item("b", "Sair")];
  assert.deepEqual(filtrarComandos(itens, "  ").map((i) => i.id), ["a", "b"]);
});

test("filtrarComandos ignora acento e usa palavras-chave", () => {
  const itens = [item("a", "Histórico"), item("b", "Trocar senha", ["password"]), item("c", "Sair")];
  assert.deepEqual(filtrarComandos(itens, "historico").map((i) => i.id), ["a"]);
  assert.deepEqual(filtrarComandos(itens, "PASS").map((i) => i.id), ["b"]);
});

test("filtrarComandos põe quem começa com o termo primeiro", () => {
  const itens = [item("a", "Nova atividade"), item("b", "Atividades da turma")];
  assert.deepEqual(filtrarComandos(itens, "ativ").map((i) => i.id), ["b", "a"]);
});

test("trechosDestacados marca a ocorrência preservando o texto original", () => {
  assert.deepEqual(trechosDestacados("Carla Souza", "car"), [
    { texto: "Car", destaque: true },
    { texto: "la Souza", destaque: false },
  ]);
});

test("trechosDestacados casa sem acento e no meio do texto", () => {
  assert.deepEqual(trechosDestacados("João Conceição", "conceicao"), [
    { texto: "João ", destaque: false },
    { texto: "Conceição", destaque: true },
  ]);
});

test("trechosDestacados sem termo ou sem ocorrência devolve o texto inteiro", () => {
  assert.deepEqual(trechosDestacados("Bruno", ""), [{ texto: "Bruno", destaque: false }]);
  assert.deepEqual(trechosDestacados("Bruno", "xyz"), [{ texto: "Bruno", destaque: false }]);
});
