import { test } from "node:test";
import assert from "node:assert/strict";
import {
  criteriosGeracaoRepetida, ERRO_BANCO_ESCOLA_GERACAO, escolherNumero, gerandoParou, JANELA_REPETIDA_MS,
  lerPedidoGeracao, textoGeracaoIniciada, textoQuestaoCompleta, textoSituacaoGeracao,
} from "./geracao-hermes";

const base = { dificuldade: "media" as const, quantidade: 5 };

test("lerPedidoGeracao: professor no banco geral é recusado", () => {
  assert.throws(() => lerPedidoGeracao({ ...base, materia: "Matemática", banco: "geral" }, "professor"), { message: ERRO_BANCO_ESCOLA_GERACAO });
});
test("lerPedidoGeracao: padrão geral para o dono, escola para o professor", () => {
  assert.equal(lerPedidoGeracao({ ...base, materia: "Matemática", banco: "geral" }, "dono").escopo, "geral");
  assert.equal(lerPedidoGeracao({ ...base, materia: "Matemática" }, "dono").escopo, "geral");
  assert.equal(lerPedidoGeracao({ ...base, materia: "Matemática", banco: "escola" }, "dono").escopo, "escola");
  assert.equal(lerPedidoGeracao({ ...base, materia: "Matemática" }, "professor").escopo, "escola");
});
test("lerPedidoGeracao: matéria vira chave; sem matéria e sem modelo falha", () => {
  assert.equal(lerPedidoGeracao({ ...base, materia: "Matemática" }, "professor").materia, "matematica");
  assert.throws(() => lerPedidoGeracao({ ...base }, "professor"), /Diga a matéria/);
});
test("lerPedidoGeracao: só modelo; orientação vazia", () => {
  const p = lerPedidoGeracao({ ...base, questao_modelo_id: " abc ", orientacao: "  ", assunto: " " }, "professor");
  assert.equal(p.materia, null);
  assert.equal(p.modeloId, "abc");
  assert.equal(p.orientacao, "");
  assert.equal(p.assunto, null);
});

test("criteriosGeracaoRepetida", () => {
  const agora = Date.now();
  const c = criteriosGeracaoRepetida({ materia: "matematica", assunto_id: null, dificuldade: "media", quantidade: 5, orientacao: "", escopo: "escola", base_id: null }, "e1", "p1", agora);
  assert.equal(c.desde, new Date(agora - JANELA_REPETIDA_MS).toISOString());
  assert.equal(c.quantidade_pedida, 5);
  assert.equal(c.status, "gerando");
  assert.equal(c.escola_id, "e1");
  assert.equal(c.professor_id, "p1");
});

test("gerandoParou", () => {
  const agora = Date.now();
  assert.equal(gerandoParou(new Date(agora - 9 * 60000).toISOString(), agora), false);
  assert.equal(gerandoParou(new Date(agora - 11 * 60000).toISOString(), agora), true);
  assert.equal(gerandoParou("xx", agora), true);
});

test("textoGeracaoIniciada", () => {
  const t = textoGeracaoIniciada({ id: "g1", rotulo: "Matemática · Porcentagem (média)", quantidade: 5, restante: 55 });
  assert.match(t, /g1/); assert.match(t, /5 questões/); assert.match(t, /situacao_geracao/); assert.match(t, /55/);
  assert.doesNotMatch(textoGeracaoIniciada({ id: "g1", rotulo: "x", quantidade: 1, restante: null }), /cota|restam|hoje/i);
});

test("textoSituacaoGeracao", () => {
  assert.match(textoSituacaoGeracao({ id: "g", status: "gerando", minutos: 2 }), /Ainda gerando/);
  const e = textoSituacaoGeracao({ id: "g", status: "erro", erro: "A IA demorou demais. Tente uma quantidade menor. (Request timed out)" });
  assert.match(e, /A IA demorou demais\. Tente uma quantidade menor\./);
  assert.doesNotMatch(e, /Request timed out/);
  const longo = "x".repeat(300);
  const c = textoSituacaoGeracao({
    id: "g", status: "concluida", link: "https://l/x", custo: 0.043,
    questoes: [{ id: "q1", enunciado: longo, resposta: "C", status: "revisao" }, { id: "q2", enunciado: "curto", resposta: null, status: "revisao" }],
  });
  for (const s of ["1)", "2)", "(C)", "q1", "q2", "https://l/x", "US$ 0,04", "…", "(sem resposta)"]) assert.ok(c.includes(s), s);
  assert.ok(!c.includes("x".repeat(130)));
  assert.match(textoSituacaoGeracao({ id: "g", status: "concluida", questoes: [] }), /nenhuma/i);
});

test("escolherNumero", () => {
  assert.equal(escolherNumero(["a", "b"], 2), "b");
  assert.throws(() => escolherNumero(["a", "b"], 0), /de 1 a 2/);
  assert.throws(() => escolherNumero(["a", "b"], 3), /de 1 a 2/);
});

test("textoQuestaoCompleta", () => {
  const t = textoQuestaoCompleta({
    id: "q1", enunciado: "Enun", comando: "Qual?", alternativas: [{ letra: "A", texto: "um" }, { letra: "C", texto: "três" }],
    resposta: "C", resolucao: "Porque sim.", status: "revisao",
  }, 1);
  for (const s of ["A) um", "C) três", "Resposta: C", "Porque sim.", "Em revisão"]) assert.ok(t.includes(s), s);
});
