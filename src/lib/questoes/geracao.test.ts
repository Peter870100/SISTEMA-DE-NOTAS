import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMIAR_PARECENCA, parecenca, respostaParaGeradas, type ContextoGeradas, type RespostaGeracao } from "./geracao";

const alts = (textos = ["um", "dois", "três", "quatro", "cinco"]) =>
  (["A", "B", "C", "D", "E"] as const).map((letra, i) => ({ letra, texto: textos[i] }));
const item = (o: Partial<RespostaGeracao["questoes"][number]> = {}): RespostaGeracao["questoes"][number] => ({
  enunciado: "A fotossíntese ocorre nos cloroplastos das plantas verdes",
  comando: "Assinale a correta.",
  alternativas: alts(),
  resposta: "C",
  resolucao: "  Porque sim.  ",
  assunto_id: null,
  ...o,
});
const ctx = (o: Partial<ContextoGeradas> = {}): ContextoGeradas => ({
  escopo: "escola", escola_id: "esc-1", materia: "biologia", assuntoPedido: null,
  assuntosValidos: new Set(["as-1", "as-2"]), referencias: [], geracao_id: "ger-1", criado_por: "u-1", ano: 2026, ...o,
});

test("parecenca: iguais = 1, ignora acento e maiúscula", () => {
  assert.equal(parecenca("A Revolução Industrial começou na Inglaterra", "a revolucao industrial comecou na inglaterra"), 1);
});
test("parecenca: textos diferentes ficam perto de 0", () => {
  assert.ok(parecenca("A fotossíntese ocorre nos cloroplastos das plantas", "O preço do produto subiu vinte por cento em março") < 0.1);
});
test("parecenca: menos de 3 palavras = 0", () => { assert.equal(parecenca("sim não", "sim não"), 0); });

test("respostaParaGeradas: descarta alternativas repetidas, vazias ou ≠ 5", () => {
  const repetidas = alts().map((a, i) => (i === 1 ? { ...a, letra: "A" as const } : a));
  const vazia = alts(["um", " ", "três", "quatro", "cinco"]);
  const quatro = alts().slice(0, 4);
  const r = respostaParaGeradas({ questoes: [item(), item({ alternativas: repetidas }), item({ alternativas: vazia }), item({ alternativas: quatro }), item({ enunciado: "  " })] }, ctx());
  assert.equal(r.linhas.length, 1);
  assert.equal(r.descartadas, 4);
});
test("respostaParaGeradas: assunto fora da lista vira o assunto pedido", () => {
  const a = respostaParaGeradas({ questoes: [item({ assunto_id: "inventado" })] }, ctx({ assuntoPedido: "as-1" }));
  assert.equal(a.linhas[0].assunto_id, "as-1");
  const b = respostaParaGeradas({ questoes: [item({ assunto_id: "inventado" })] }, ctx());
  assert.equal(b.linhas[0].assunto_id, null);
  const c = respostaParaGeradas({ questoes: [item({ assunto_id: "as-2" })] }, ctx({ assuntoPedido: "as-1" }));
  assert.equal(c.linhas[0].assunto_id, "as-2");
});
test("respostaParaGeradas: parecida com referência marca revisão com o rótulo", () => {
  const q = item();
  const r = respostaParaGeradas({ questoes: [q] }, ctx({ referencias: [{ rotulo: "ENEM 2019 nº 45", texto: `${q.enunciado} ${q.comando}` }] }));
  assert.equal(r.linhas[0].precisa_revisao, true);
  assert.equal(r.linhas[0].motivo_revisao, "Parecida demais com ENEM 2019 nº 45.");
});
test("respostaParaGeradas: duas geradas iguais entre si → a segunda marcada", () => {
  const r = respostaParaGeradas({ questoes: [item(), item()] }, ctx());
  assert.equal(r.linhas[0].precisa_revisao, false);
  assert.equal(r.linhas[0].motivo_revisao, null);
  assert.equal(r.linhas[1].precisa_revisao, true);
  assert.equal(r.linhas[1].motivo_revisao, "Parecida demais com outra questão gerada.");
});
test("respostaParaGeradas: questão distinta não é marcada", () => {
  const r = respostaParaGeradas({ questoes: [item(), item({ enunciado: "O preço do produto subiu vinte por cento em março", comando: "Calcule o novo valor." })] }, ctx());
  assert.ok(parecenca("a b c d", "a b c d") >= LIMIAR_PARECENCA);
  assert.equal(r.linhas[1].precisa_revisao, false);
});
test("respostaParaGeradas: monta a linha com origem ia", () => {
  const r = respostaParaGeradas({ questoes: [item({ alternativas: alts([" a ", "b", "c", "d", "e "]).reverse() })] }, ctx());
  const l = r.linhas[0];
  assert.equal(l.origem, "ia");
  assert.equal(l.status, "revisao");
  assert.equal(l.banca, "Gerada por IA");
  assert.equal(l.caderno, "");
  assert.equal(l.numero, null);
  assert.equal(l.area, "natureza");
  assert.equal(l.materia, "biologia");
  assert.equal(l.resolucao, "Porque sim.");
  assert.equal(l.geracao_id, "ger-1");
  assert.equal(l.criado_por, "u-1");
  assert.equal(l.escopo, "escola");
  assert.equal(l.escola_id, "esc-1");
  assert.equal(l.ano, 2026);
  assert.equal(l.resposta, "C");
  assert.deepEqual(l.alternativas?.map((a) => a.letra), ["A", "B", "C", "D", "E"]);
  assert.equal(l.alternativas?.[0].texto, "a");
  assert.equal(l.alternativas?.[4].texto, "e");
});
