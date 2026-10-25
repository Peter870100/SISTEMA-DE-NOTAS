import { test } from "node:test";
import assert from "node:assert/strict";
import { conteudoDeMarkdown, type DocConteudo } from "./conteudo";
import { AVISO_FORMATACAO_REINICIADA, aplicarEdicao, documentosAposEdicao, limparResolucao, type QuestaoEditavel } from "./edicao";

const docComFigura: DocConteudo = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Texto antigo", marks: [{ type: "bold" }] }] },
    { type: "figura", attrs: { imagemId: "img-1", legenda: "", alinhamento: "centro" } },
    { type: "paragraph", content: [{ type: "text", text: "depois da figura" }] },
  ],
};
const docAlt = (t: string): DocConteudo => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t, marks: [{ type: "italic" }] }] }] });

const base: QuestaoEditavel = {
  enunciado: "Texto antigo\ndepois da figura",
  conteudo: docComFigura,
  comando: "Assinale",
  alternativas: [
    { letra: "A", texto: "a1", conteudo: docAlt("a1") },
    { letra: "B", texto: "b1", conteudo: docAlt("b1") },
    { letra: "C", texto: "c1" },
    { letra: "D", texto: "d1" },
    { letra: "E", texto: "e1" },
  ],
  resposta: "A",
  anulada: false,
  materia: "historia",
  status: "revisao",
};

const temFigura = (d: DocConteudo | null) => JSON.stringify(d).includes('"figura"');

test("enunciado novo numa questão com documento: documento refeito do texto, sem figura, com aviso", () => {
  const r = documentosAposEdicao(base, { enunciado: "Texto **novo**" });
  assert.deepEqual(r.conteudo, conteudoDeMarkdown("Texto **novo**"));
  assert.equal(temFigura(r.conteudo), false);
  assert.deepEqual(r.avisos, [AVISO_FORMATACAO_REINICIADA]);
  assert.equal(AVISO_FORMATACAO_REINICIADA, "A formatação do enunciado foi reiniciada; as figuras voltaram para o fim do texto.");
});

test("sem enunciado na edição: o documento original sai intacto", () => {
  const r = documentosAposEdicao(base, { comando: "Outro comando" });
  assert.deepEqual(r.conteudo, docComFigura);
  assert.deepEqual(r.alternativas, base.alternativas);
  assert.deepEqual(r.avisos, []);
});

test("enunciado igual ao atual não reinicia a formatação", () => {
  const r = documentosAposEdicao(base, { enunciado: "  Texto antigo\ndepois da figura " });
  assert.equal(r.conteudo, docComFigura);
  assert.deepEqual(r.avisos, []);
});

test("questão sem documento: continua null e sem aviso", () => {
  const r = documentosAposEdicao({ ...base, conteudo: null }, { enunciado: "Novo" });
  assert.equal(r.conteudo, null);
  assert.deepEqual(r.avisos, []);
});

test("alternativa B alterada: só a B ganha documento novo", () => {
  const r = documentosAposEdicao(base, { alternativas: [{ letra: "B", texto: "b **dois**" }] });
  assert.deepEqual(r.alternativas.find((a) => a.letra === "B")?.conteudo, conteudoDeMarkdown("b **dois**"));
  for (const letra of ["A", "C", "D", "E"] as const) {
    assert.deepEqual(r.alternativas.find((a) => a.letra === letra), base.alternativas.find((a) => a.letra === letra));
  }
  assert.deepEqual(r.avisos, []);
  assert.equal(r.conteudo, docComFigura);
});

test("aplicarEdicao: texto puro derivado do documento novo", () => {
  const r = aplicarEdicao(base, { enunciado: "Texto **novo**", alternativas: [{ letra: "B", texto: "b **dois**" }, { letra: "C", texto: " c2 " }] });
  assert.equal(r.campos.enunciado, "Texto novo");
  assert.deepEqual(r.campos.conteudo, conteudoDeMarkdown("Texto **novo**"));
  const alts = r.campos.alternativas!;
  assert.equal(alts.length, 5);
  assert.equal(alts.find((a) => a.letra === "B")?.texto, "b dois");
  assert.deepEqual(alts.find((a) => a.letra === "C"), { letra: "C", texto: "c2" });
  assert.deepEqual(r.avisos, [AVISO_FORMATACAO_REINICIADA]);
});

test("aplicarEdicao: só os campos enviados", () => {
  const r = aplicarEdicao(base, { comando: "  Marque  " });
  assert.deepEqual(r.campos, { comando: "Marque" });
  assert.deepEqual(aplicarEdicao(base, { materia: "fisica" }).campos, { materia: "fisica", area: "natureza" });
  assert.deepEqual(aplicarEdicao({ ...base, conteudo: null }, { enunciado: " Novo " }).campos, { enunciado: "Novo" });
});

test("aplicarEdicao: mesmas validações da tela", () => {
  assert.throws(() => aplicarEdicao(base, { materia: "astrologia" }), { message: "Escolha a matéria." });
  assert.throws(() => aplicarEdicao(base, { resposta: "F" as never }), { message: "Resposta inválida." });
  assert.throws(() => aplicarEdicao(base, { alternativas: [{ letra: "G" as never, texto: "x" }] }), { message: "Alternativa inválida." });
  assert.throws(() => aplicarEdicao(base, {}), { message: "Nada para alterar." });
  assert.throws(() => aplicarEdicao({ ...base, status: "publicada" }, { resposta: null }), { message: "Questão publicada precisa de resposta (ou ser anulada)." });
  assert.deepEqual(aplicarEdicao({ ...base, status: "publicada" }, { resposta: null, anulada: true }).campos, { resposta: null, anulada: true });
});

test("limparResolucao: ausente mantém, vazio vira null, apara e limita a 5.000", () => {
  assert.equal(limparResolucao(undefined), undefined);
  assert.equal(limparResolucao("  "), null);
  assert.equal(limparResolucao(" x "), "x");
  assert.equal(limparResolucao("a".repeat(5000)), "a".repeat(5000));
  assert.throws(() => limparResolucao("a".repeat(5001)), /até 5\.000 caracteres/);
});
