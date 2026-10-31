import { test } from "node:test";
import assert from "node:assert/strict";
import { ehCredito, numero2, separarCredito } from "./texto";
import { avisosDaQuestao } from "./avisos";
import { folhaAluno, folhaGabarito, type QuestaoFolha } from "./docx";

function qf(enunciado: string): QuestaoFolha {
  return {
    id: "q1",
    enunciado,
    comando: "Assinale a alternativa correta.",
    alternativas: [
      { letra: "A", texto: "2" },
      { letra: "B", texto: "4" },
      { letra: "C", texto: "6" },
      { letra: "D", texto: "8" },
      { letra: "E", texto: "16" },
    ],
    resposta: "B",
    resolucao: "2² = 2 · 2 = 4.",
    materia: "Matemática",
  };
}

test("ehCredito", () => {
  assert.equal(ehCredito("ANDRADE, M. Macunaíma. Disponível em: www.bd.camara.leg.br. Acesso em: 17 set. 2023."), true);
  assert.equal(ehCredito("ZIEGLER, M. F. Disponível em: www.revistagalileu.globo.com."), true);
  assert.equal(ehCredito("Os produtos estavam disponíveis em várias lojas da cidade e o preço subiu 20% no mês."), false);
  assert.equal(ehCredito(""), false);
});
test("separarCredito: só o último parágrafo", () => {
  const r = separarCredito("Texto **forte** um.\nTexto dois.\nSILVA, J. Livro. Acesso em: 1 jan. 2024.");
  assert.equal(r.credito, "SILVA, J. Livro. Acesso em: 1 jan. 2024.");
  assert.equal(r.corpo.length, 2);
  assert.ok(r.corpo[0].some((s) => s.negrito && s.texto === "forte"));
  assert.equal(separarCredito("Sem crédito nenhum aqui.").credito, null);
});
test("numero2", () => { assert.equal(numero2(1), "01"); assert.equal(numero2(12), "12"); });
test("folhaAluno e folhaGabarito geram .docx (zip)", async () => {
  const d = { titulo: "Tarefa de Matemática", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")] };
  for (const b of [await folhaAluno(d), await folhaGabarito(d)]) assert.equal(b.subarray(0, 2).toString(), "PK");
});

async function documentoXml(b: Buffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(b);
  const arquivo = zip.file("word/document.xml");
  assert.ok(arquivo, "word/document.xml ausente");
  return arquivo.async("string");
}

test("folha do aluno: questão numerada, identificação e fontes", async () => {
  const d = {
    titulo: "Tarefa de Matemática — Porcentagem",
    subtitulo: "9º ano",
    escola: "Colégio Status",
    logo: null,
    questoes: [qf("Quanto é 2²?"), qf("Quanto é 3²?")],
  };
  const xml = await documentoXml(await folhaAluno(d));
  for (const t of ["QUESTÃO 01", "QUESTÃO 02", "Aluno(a)", "Cambria", "Calibri", "MATEMÁTICA", "questões 01 a 02", "9º ano"]) {
    assert.ok(xml.includes(t), `faltou "${t}"`);
  }
  assert.ok(xml.includes("TAREFA DE MATEMÁTICA — PORCENTAGEM"));
});

test("gabarito: resposta e sem linhas de identificação", async () => {
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")] };
  const xml = await documentoXml(await folhaGabarito(d));
  assert.ok(xml.includes("Resposta"));
  assert.ok(xml.includes("Gabarito comentado"));
  assert.ok(xml.includes("QUESTÃO 01"));
  assert.ok(!xml.includes("Aluno(a)"));
});

test("avisosDaQuestao", () => {
  assert.deepEqual(avisosDaQuestao({ id: "a", temImagem: false, temConteudo: false }, 1), []);
  assert.match(avisosDaQuestao({ id: "a", temImagem: true, temConteudo: false }, 3)[0], /Questão 3 .*figura/);
  assert.match(avisosDaQuestao({ id: "a", temImagem: false, temConteudo: true }, 2)[0], /Questão 2 .*formatação/);
});
