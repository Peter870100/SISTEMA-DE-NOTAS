import { test } from "node:test";
import assert from "node:assert/strict";
import { escritasParaResposta, textoQuestoesSalvas, type QuestaoEscrita } from "./escritas";
import { respostaParaGeradas, type ContextoGeradas } from "./geracao";

const q = (enunciado: string): QuestaoEscrita => ({
  enunciado,
  comando: "Assinale a correta.",
  alternativas: (["A", "B", "C", "D", "E"] as const).map((letra) => ({ letra, texto: `alternativa ${letra}` })),
  resposta: "B",
  resolucao: "r",
});
const ctxBase: ContextoGeradas = {
  escopo: "geral", escola_id: null, materia: "matematica", assuntoPedido: null,
  assuntosValidos: new Set(), referencias: [], geracao_id: "g1", criado_por: "p1", ano: 2026,
};

test("escritasParaResposta: mantém ordem e zera assunto_id", () => {
  const r = escritasParaResposta([q("Um"), q("Dois")]);
  assert.deepEqual(r.questoes.map((x) => x.enunciado), ["Um", "Dois"]);
  assert.ok(r.questoes.every((x) => x.assunto_id === null));
});
test("respostaParaGeradas descarta alternativa repetida (via escritas)", () => {
  const ruim = { ...q("Três"), alternativas: q("x").alternativas.map((a) => ({ ...a, texto: "igual" })) };
  const { linhas, descartadas } = respostaParaGeradas(escritasParaResposta([q("Um enunciado bem diferente aqui"), ruim]), ctxBase);
  assert.equal(linhas.length, 1);
  assert.equal(descartadas, 1);
  assert.equal(linhas[0].status, "revisao");
  assert.equal(linhas[0].origem, "ia");
  assert.equal(linhas[0].escopo, "geral");
});
test("textoQuestoesSalvas: ids na ordem, descartadas e link", () => {
  const t = textoQuestoesSalvas({ geracaoId: "g1", ids: ["a", "b"], descartadas: 1, link: "https://x/banco" });
  assert.match(t, /2 questões salvas em revisão/);
  assert.match(t, /1\. a\n2\. b/);
  assert.match(t, /1 descartada/);
  assert.match(t, /https:\/\/x\/banco/);
  assert.match(t, /g1/);
});
test("textoQuestoesSalvas: singular e sem descartadas", () => {
  const t = textoQuestoesSalvas({ geracaoId: "g2", ids: ["a"], descartadas: 0, link: "l" });
  assert.match(t, /^1 questão salva em revisão/);
  assert.doesNotMatch(t, /descartada/);
});
