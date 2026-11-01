import { test } from "node:test";
import assert from "node:assert/strict";
import { itensGabarito, itensProva, type FiguraRef, type ItemFolha, type QuestaoBase } from "./estrutura";

function questao(enunciado: string, o: Partial<QuestaoBase<FiguraRef>> = {}): QuestaoBase<FiguraRef> {
  return {
    id: "q1",
    enunciado,
    comando: "Assinale a alternativa correta.",
    alternativas: ["A", "B", "C", "D", "E"].map((letra, i) => ({ letra, texto: String(2 * (i + 1)) })),
    resposta: "B",
    resolucao: "2² = 4.\nLogo, **B**.",
    materia: "Matemática",
    ...o,
  };
}

const tipos = (itens: ItemFolha<FiguraRef>[]) => itens.map((i) => i.tipo);
const ALTERNATIVAS = Array(5).fill("alternativa");
const TABELA = ["A tabela mostra os dados.", "| Trecho | Tempo |", "|---|---|", "| 0 a 1 km | 06:30 |", "Texto depois."].join("\n");

test("markdown com tabela e sem figura: parágrafo, tabela, parágrafo, comando e alternativas", () => {
  const itens = itensProva([questao(TABELA)]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "paragrafo", "tabela", "paragrafo", "comando", ...ALTERNATIVAS]);
  const tabela = itens.find((i) => i.tipo === "tabela");
  assert.deepEqual(tabela, { tipo: "tabela", linhas: [["Trecho", "Tempo"], ["0 a 1 km", "06:30"]] });
  const paragrafos = itens.filter((i) => i.tipo === "paragrafo");
  assert.deepEqual(paragrafos.map((p) => p.tipo === "paragrafo" && p.indice), [0, 1]);
  const comando = itens.find((i) => i.tipo === "comando");
  assert.ok(comando?.tipo === "comando" && comando.comTexto && comando.indice === 0);
});

test("crédito e origem viram um item antes do comando", () => {
  const q = questao("Texto.\nSILVA, J. Livro. Acesso em: 1 jan. 2024.", { origem: " UFMS 2024 " });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "paragrafo", "credito", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[3], { tipo: "credito", credito: "SILVA, J. Livro. Acesso em: 1 jan. 2024.", origem: "UFMS 2024" });
});

test("com figura do enunciado a tabela sai e a figura vem depois dos parágrafos", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const itens = itensProva([questao(TABELA, { figuras: [f] })]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "paragrafo", "paragrafo", "figura", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[4], { tipo: "figura", figura: f, naAlternativa: false });
});

test("comando repetido no fim do enunciado não gera item comando", () => {
  const itens = itensProva([questao("Um texto. Assinale a alternativa correta.")]);
  assert.ok(!tipos(itens).includes("comando"));
});

test("figura de alternativa B vem logo após a alternativa B", () => {
  const f: FiguraRef = { id: "fb", alvo: "B", alinhamento: "direita" };
  const itens = itensProva([questao("Qual figura?", { figuras: [f] })]);
  const i = itens.findIndex((x) => x.tipo === "alternativa" && x.letra === "B");
  assert.deepEqual(itens[i + 1], { tipo: "figura", figura: f, alinhamento: "esquerda", naAlternativa: true });
  assert.equal(itens[i + 2].tipo, "alternativa");
});

test("conteúdo formatado: nós do TipTap, figura no lugar e caixa só com parágrafos com texto", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const q = questao("ignorado", {
    conteudo: {
      type: "doc",
      content: [
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ type: "text", text: "Primeiro." }] },
        { type: "figura", attrs: { imagemId: "f1", alinhamento: "direita", legenda: " Fig. 1 " } },
        { type: "caixa", content: [{ type: "paragraph", content: [] }, { type: "paragraph", content: [{ type: "text", text: "Na caixa." }] }] },
        { type: "caixa", content: [{ type: "paragraph", content: [] }] },
        { type: "horizontalRule" },
      ],
    },
    figuras: [f],
  });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "noConteudo", "figura", "noConteudo", "noConteudo", "comando", ...ALTERNATIVAS]);
  assert.ok(itens[2].tipo === "noConteudo" && itens[2].primeiro);
  assert.deepEqual(itens[3], { tipo: "figura", figura: f, alinhamento: "direita", legenda: "Fig. 1", naAlternativa: false });
  assert.ok(itens[4].tipo === "noConteudo" && !itens[4].primeiro && itens[4].no.content?.length === 1);
});

test("duas matérias: duas faixas com os intervalos certos", () => {
  const itens = itensProva([questao("a"), questao("b"), questao("c", { materia: "Português" })]);
  const faixas = itens.filter((i) => i.tipo === "faixa");
  assert.deepEqual(faixas, [
    { tipo: "faixa", materia: "Matemática", de: 1, ate: 2, primeira: true },
    { tipo: "faixa", materia: "Português", de: 3, ate: 3, primeira: false },
  ]);
  const titulos = itens.filter((i) => i.tipo === "titulo");
  assert.deepEqual(titulos.map((t) => t.tipo === "titulo" && [t.numero, t.primeiraDoBloco]), [[1, true], [2, false], [3, true]]);
});

test("aviso final é o último item (e some quando vazio)", () => {
  const itens = itensProva([questao("a")], "  Prova gerada pelo Status Avalia ");
  assert.deepEqual(itens.at(-1), { tipo: "aviso", texto: "Prova gerada pelo Status Avalia" });
  assert.notEqual(itensProva([questao("a")], "  ").at(-1)?.tipo, "aviso");
  assert.equal(itensGabarito([questao("a")], "Fim").at(-1)?.tipo, "aviso");
});

test("gabarito: título, resoluções e resposta", () => {
  const itens = itensGabarito([questao("a")]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "resolucao", "resolucao", "resposta"]);
  assert.deepEqual(itens.at(-1), { tipo: "resposta", letra: "B" });
  assert.deepEqual(itensGabarito([questao("a", { resposta: " ", resolucao: null })]).at(-1), { tipo: "resposta", letra: null });
});
