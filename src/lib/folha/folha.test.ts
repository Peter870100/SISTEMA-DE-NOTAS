import { test } from "node:test";
import assert from "node:assert/strict";
import { celulasTabela, comandoRepetido, ehCredito, numero2, separarCredito } from "./texto";
import { avisosDaQuestao } from "./avisos";
import { folhaAluno, folhaGabarito, type FiguraFolha, type QuestaoFolha } from "./docx";

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
  for (const t of ["QUESTÃO 01", "QUESTÃO 02", "Aluno(a)", "Arial", "Calibri", "MATEMÁTICA", "questões 01 a 02", "9º ano"]) {
    assert.ok(xml.includes(t), `faltou "${t}"`);
  }
  assert.ok(xml.includes("TAREFA DE MATEMÁTICA — PORCENTAGEM"));
});

// PNG mínimo válido (1×1) para as bolinhas nos testes.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const BOLINHAS = { A: PNG_1X1, B: PNG_1X1, C: PNG_1X1, D: PNG_1X1, E: PNG_1X1 };

test("folha do aluno com bolinhas: 5 imagens por questão e faixa cinza do título", async () => {
  const questoes = [qf("Quanto é 2²?"), qf("Quanto é 3²?")];
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes, bolinhas: BOLINHAS };
  const xml = await documentoXml(await folhaAluno(d));
  const imagens = xml.split("<pic:pic").length - 1;
  assert.ok(imagens >= 5 * questoes.length, `esperava ≥ ${5 * questoes.length} imagens, veio ${imagens}`);
  assert.ok(xml.includes("D9D9D9"));
  assert.ok(xml.includes("QUESTÃO 02"));
  assert.ok(!xml.includes("Cambria"));
});

test("folha sem bolinhas continua gerando (letra em caixinha)", async () => {
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")], bolinhas: null };
  const b = await folhaAluno(d);
  assert.equal(b.subarray(0, 2).toString(), "PK");
  const xml = await documentoXml(b);
  assert.ok(xml.includes("QUESTÃO 01"));
  assert.equal(xml.split("<pic:pic").length - 1, 0);
});

test("gabarito com bolinhas: resposta com a bolinha da letra certa", async () => {
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [qf("Quanto é 2²?")], bolinhas: BOLINHAS };
  const xml = await documentoXml(await folhaGabarito(d));
  assert.ok(xml.includes("Resposta"));
  assert.equal(xml.split("<pic:pic").length - 1, 1);
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

// ---------- conteúdo formatado, figuras, origem e aviso final ----------

const LARGURA_COLUNA_EMU = Math.floor((11906 - 2 * Math.round(1.5 * 567) - Math.round(0.8 * 567)) / 2) * 635;

function figura(
  id: string,
  alvo: FiguraFolha["alvo"],
  o: Partial<FiguraFolha> = {},
): FiguraFolha {
  return { id, alvo, png: PNG_1X1, largura: 800, altura: 400, alinhamento: "centro", ...o };
}

function contarImagens(xml: string): number {
  return xml.split("<pic:pic").length - 1;
}

test("conteúdo: negrito e figura do enunciado viram run negrito e 1 imagem", async () => {
  const q: QuestaoFolha = {
    ...qf("texto antigo que não deve aparecer"),
    conteudo: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Veja o " }, { type: "text", text: "forte", marks: [{ type: "bold" }] }] },
        { type: "figura", attrs: { imagemId: "f1", alinhamento: "centro", legenda: "Figura 1" } },
      ],
    },
    figuras: [figura("f1", "enunciado")],
  };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  assert.match(xml, /<w:b\/>(?:(?!<\/w:r>)[\s\S])*forte/);
  assert.equal(contarImagens(xml), 1);
  assert.ok(xml.includes("Figura 1"));
  assert.ok(!xml.includes("texto antigo"));
});

test("figura larga é limitada à largura da coluna", async () => {
  const q: QuestaoFolha = { ...qf("Observe."), figuras: [figura("f1", "enunciado", { largura: 4000, altura: 1000 })] };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  const m = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  assert.ok(m, "sem <wp:extent>");
  assert.ok(Number(m[1]) <= LARGURA_COLUNA_EMU, `cx ${m[1]} > ${LARGURA_COLUNA_EMU}`);
  assert.ok(Math.abs(Number(m[1]) / Number(m[2]) - 4) < 0.05, "proporção não mantida");
});

test("figura indisponível vira aviso", async () => {
  const q: QuestaoFolha = { ...qf("Observe."), figuras: [figura("f1", "enunciado", { png: null })] };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  assert.ok(xml.includes("[Figura indisponível]"));
  assert.equal(contarImagens(xml), 0);
});

test("figura do enunciado sem nó no conteúdo vai depois do texto", async () => {
  const q: QuestaoFolha = { ...qf("Observe a figura."), figuras: [figura("f1", "enunciado")] };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  assert.equal(contarImagens(xml), 1);
  const texto = xml.indexOf("Observe a figura.");
  const imagem = xml.indexOf("<pic:pic");
  const comando = xml.indexOf("Assinale a alternativa correta.");
  assert.ok(texto < imagem && imagem < comando, "figura fora de ordem");
});

test("figura de alternativa aparece na alternativa", async () => {
  const q: QuestaoFolha = { ...qf("Qual figura?"), figuras: [figura("fb", "B")] };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  assert.equal(contarImagens(xml), 1);
  const imagem = xml.indexOf("<pic:pic");
  assert.ok(xml.lastIndexOf(">4<", imagem) > xml.lastIndexOf(">2<", imagem), "figura antes da alternativa B");
  assert.ok(imagem < xml.indexOf(">6<"), "figura depois da alternativa C");
});

test("alternativa com conteúdo usa os runs formatados", async () => {
  const q: QuestaoFolha = {
    ...qf("Qual?"),
    alternativas: [
      { letra: "A", texto: "H2O", conteudo: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "H" }, { type: "text", text: "2", marks: [{ type: "subscript" }] }, { type: "text", text: "O" }] }] } },
    ],
  };
  const xml = await documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
  assert.match(xml, /<w:vertAlign w:val="subscript"\/>/);
});

test("origem e aviso final", async () => {
  const q: QuestaoFolha = { ...qf("Quanto é 2²?"), origem: "UFMS 2024" };
  const d = { titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q], avisoFinal: "Prova gerada pelo Status Avalia" };
  const aluno = await documentoXml(await folhaAluno(d));
  const gabarito = await documentoXml(await folhaGabarito(d));
  assert.ok(aluno.includes("UFMS 2024"));
  assert.ok(aluno.includes("Prova gerada pelo Status Avalia"));
  assert.ok(gabarito.includes("Prova gerada pelo Status Avalia"));
});

test("comandoRepetido: enunciado que já termina com o comando", () => {
  assert.equal(comandoRepetido("Texto longo. Dessa forma, é **correto** afirmar que", "Dessa forma, é correto  afirmar que"), true);
  assert.equal(comandoRepetido("Texto sobre a ferrovia?**", "a ferrovia?"), true);
  assert.equal(comandoRepetido("Texto qualquer.", "Assinale a alternativa correta."), false);
  assert.equal(comandoRepetido("Texto.", ""), false);
});
test("celulasTabela: linha de tabela em markdown", () => {
  assert.deepEqual(celulasTabela("| Trecho | Tempo (min) |"), ["Trecho", "Tempo (min)"]);
  assert.deepEqual(celulasTabela("|---|:---:|"), []);
  assert.equal(celulasTabela("Texto com | barra no meio"), null);
});
const TABELA = ["A tabela mostra os dados.", "| Trecho | Tempo |", "|---|---|", "| 0 a 1 km | 06:30 |", "Texto depois."].join("\n");
test("tabela em markdown vira tabela do Word, sem as barras", async () => {
  const xml = await xmlAluno({ ...qf(TABELA), comando: "" });
  assert.ok(xml.includes("06:30"));
  assert.ok(!xml.includes("|"), "sobrou barra da tabela");
  assert.ok(!xml.includes("---"));
  assert.ok(xml.indexOf("A tabela mostra") < xml.indexOf("06:30") && xml.indexOf("06:30") < xml.indexOf("Texto depois."));
});
test("tabela em markdown some quando a questão já tem a figura do enunciado", async () => {
  const xml = await xmlAluno({ ...qf(TABELA), figuras: [{ id: "f1", alvo: "enunciado", png: PNG_1X1, largura: 100, altura: 50, alinhamento: "centro" }] });
  assert.ok(!xml.includes("06:30"));
  assert.ok(xml.includes("Texto depois."));
});
test("comando repetido no fim do enunciado não sai duas vezes", async () => {
  const xml = await xmlAluno({ ...qf("Um texto. Assinale a alternativa correta."), comando: "Assinale a alternativa correta." });
  assert.equal(xml.split("Assinale a alternativa correta.").length - 1, 1);
});

async function xmlAluno(q: QuestaoFolha): Promise<string> {
  return documentoXml(await folhaAluno({ titulo: "Tarefa", escola: "Colégio Status", logo: null, questoes: [q] }));
}
