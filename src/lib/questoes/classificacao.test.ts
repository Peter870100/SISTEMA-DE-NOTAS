import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_LOTE, validarItens, mesmoAssunto, mesmaArea, habilidadesFinais, planoJuntarTopicos, nomeNormalizado,
  type QuestaoLote, type ItemLote,
} from "./classificacao";
import type { Ator } from "./regras";

const dono: Ator = { id: "d", role: "dono", escola_id: "e1" };
const prof: Ator = { id: "p", role: "professor", escola_id: "e1" };

const q = (id: string, o: Partial<QuestaoLote> = {}): QuestaoLote => ({
  id, assunto_id: "a1", area: "matematica", escopo: "escola", escola_id: "e1", criado_por: "p", ...o,
});
const questoes = new Map<string, QuestaoLote>([
  ["q1", q("q1")],
  ["geral", q("geral", { escopo: "geral", escola_id: null, criado_por: null })],
]);
const topicos = new Map([["t1", { assunto_id: "a1" }], ["t2", { assunto_id: "a2" }]]);
const habilidades = new Map<string, { area: "matematica" | "humanas" }>([["h1", { area: "matematica" }], ["h2", { area: "humanas" }]]);

const rodar = (itens: ItemLote[], ator = prof) => validarItens(itens, questoes, topicos, habilidades, ator);

test("recusa questão inexistente", () => {
  assert.deepEqual(rodar([{ questaoId: "x" }]).recusados, [{ questaoId: "x", motivo: "Questão não encontrada." }]);
});
test("professor não edita questão do banco geral; dono sim", () => {
  assert.equal(rodar([{ questaoId: "geral" }]).recusados[0].motivo, "Sem permissão para editar esta questão.");
  assert.equal(rodar([{ questaoId: "geral" }], dono).aceitos.length, 1);
});
test("recusa tópico inexistente e de outro assunto", () => {
  assert.equal(rodar([{ questaoId: "q1", topicoId: "zz" }]).recusados[0].motivo, "Tópico não encontrado.");
  assert.equal(rodar([{ questaoId: "q1", topicoId: "t2" }]).recusados[0].motivo, "O tópico é de outro assunto.");
});
test("recusa habilidade inexistente e de outra área", () => {
  assert.equal(rodar([{ questaoId: "q1", habilidadeIds: ["zz"] }]).recusados[0].motivo, "Habilidade não encontrada.");
  assert.equal(rodar([{ questaoId: "q1", habilidadeIds: ["h1", "h2"] }]).recusados[0].motivo, "A habilidade é de outra área.");
});
test("válidos seguem junto com inválidos", () => {
  const r = rodar([{ questaoId: "q1", topicoId: "t1", habilidadeIds: ["h1"] }, { questaoId: "x" }, { questaoId: "q1", topicoId: null }]);
  assert.equal(r.aceitos.length, 2);
  assert.equal(r.recusados.length, 1);
});
test("mais de 50 itens lança erro", () => {
  const itens = Array.from({ length: LIMITE_LOTE + 1 }, () => ({ questaoId: "q1" }));
  assert.throws(() => rodar(itens), /No máximo 50 questões por vez\./);
  assert.doesNotThrow(() => rodar(itens.slice(0, 50)));
});
test("habilidadesFinais", () => {
  assert.deepEqual(habilidadesFinais(["a", "b"], ["b", "c", "c"], "adicionar"), ["a", "b", "c"]);
  assert.deepEqual(habilidadesFinais(["a", "b"], ["c", "c", "d"], "trocar"), ["c", "d"]);
});
test("mesmoAssunto e mesmaArea", () => {
  assert.equal(mesmoAssunto([q("1"), q("2")]), "a1");
  assert.equal(mesmoAssunto([q("1"), q("2", { assunto_id: "a2" })]), null);
  assert.equal(mesmoAssunto([q("1", { assunto_id: null })]), null);
  assert.equal(mesmoAssunto([]), null);
  assert.equal(mesmaArea([q("1"), q("2")]), "matematica");
  assert.equal(mesmaArea([q("1"), q("2", { area: "humanas" })]), null);
});
test("nomeNormalizado", () => {
  assert.equal(nomeNormalizado("  Derivação "), "derivacao");
});
test("planoJuntarTopicos", () => {
  const p = planoJuntarTopicos(
    [{ id: "o1", nome: "Derivação" }, { id: "o2", nome: "Limites" }],
    [{ id: "d1", nome: "derivacao" }],
  );
  assert.deepEqual(p, { mover: ["o2"], juntar: [{ de: "o1", para: "d1" }] });
});
