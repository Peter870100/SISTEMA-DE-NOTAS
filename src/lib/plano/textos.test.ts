import { test } from "node:test";
import assert from "node:assert/strict";
import { REGRAS_PADRAO as R } from "./regras";
import { formatarMinutos, textoCriterio, textoQuestoesDisponiveis, textoRecomendacao, textoResolucoes, textoSemMaterial, tituloTreino } from "./textos";

test("textos do plano de estudo", () => {
  assert.equal(textoRecomendacao({ tipo: "revisar", nome: "Porcentagem", erros: 7, questoes: 10, foco: null }, R),
    "Você errou 7 de 10 questões de Porcentagem. Revise esse conteúdo e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.equal(textoRecomendacao({ tipo: "revisar", nome: "Morfologia", erros: 7, questoes: 10, foco: { topicoId: "t", nome: "Derivação parassintética", erros: 4, questoes: 5 } }, R),
    "Você errou 7 de 10 questões de Morfologia, 4 delas sobre Derivação parassintética. Revise esse tópico e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.equal(textoRecomendacao({ tipo: "mais_respostas", nome: "Porcentagem", erros: 1, questoes: 1, foco: null }, R),
    "Você respondeu só 1 questão de Porcentagem e errou 1. Precisamos de mais respostas: resolva 5 questões de diagnóstico para entender melhor.");
  assert.equal(textoRecomendacao({ tipo: "mais_respostas", nome: "Porcentagem", erros: 2, questoes: 3, foco: null }, R),
    "Você respondeu só 3 questões de Porcentagem e errou 2. Precisamos de mais respostas: resolva 5 questões de diagnóstico para entender melhor.");
  assert.equal(textoCriterio({ ...R, minQuestoesPrioridade: 8, taxaErroPrioridade: 70 }),
    "Sugestão pelo critério: 8 ou mais questões e 70% ou mais de erro. Um resultado isolado não comprova uma dificuldade.");
  assert.deepEqual([15, 60, 105, 120].map(formatarMinutos), ["15 min", "1 h", "1 h 45", "2 h"]);
  assert.equal(textoSemMaterial("Porcentagem", true), "Ainda não há material de revisão para Porcentagem.");
  assert.equal(textoSemMaterial("Porcentagem", false), "Ainda não há material de revisão para Porcentagem. Peça ao seu professor uma indicação.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 5, 5), null);
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 0, 5), "Não há questões novas de Porcentagem no banco agora.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 1, 5), "Só há 1 questão nova de Porcentagem agora; a sequência terá 1.");
  assert.equal(textoQuestoesDisponiveis("Porcentagem", 3, 5), "Só há 3 questões novas de Porcentagem agora; a sequência terá 3.");
  assert.equal(textoResolucoes(1), "Releia a resolução da questão que você errou");
  assert.equal(textoResolucoes(3), "Releia as resoluções das 3 questões que você errou");
  assert.equal(tituloTreino("pratica", "Porcentagem"), "Prática: Porcentagem");
  assert.equal(tituloTreino("diagnostico", "X"), "Diagnóstico: X"); assert.equal(tituloTreino("revisao", "X"), "Revisão: X");
  assert.equal(tituloTreino("pratica", "a".repeat(200)).length, 120);
});
