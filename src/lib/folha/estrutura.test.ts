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

test("com figura do enunciado a tabela sai e a figura vem antes dos parágrafos", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const itens = itensProva([questao(TABELA, { figuras: [f] })]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "figura", "paragrafo", "paragrafo", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[2], { tipo: "figura", figura: f, naAlternativa: false });
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

test("markdown com figura no enunciado: figura antes do texto inteiro, crédito e sem comando repetido", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const q = questao("Um texto.\n**Assinale a alternativa correta.**", { figuras: [f], origem: "UFGD 2023" });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "figura", "paragrafo", "paragrafo", "credito", ...ALTERNATIVAS]);
  assert.deepEqual(itens[5], { tipo: "credito", credito: null, origem: "UFGD 2023" });
  assert.deepEqual(itens[2], { tipo: "figura", figura: f, naAlternativa: false });
  assert.deepEqual(itens[3], { tipo: "paragrafo", segmentos: [{ texto: "Um texto.", negrito: false, italico: false }], indice: 0 });
  assert.deepEqual(itens[4], { tipo: "paragrafo", segmentos: [{ texto: "Assinale a alternativa correta.", negrito: true, italico: false }], indice: 1 });
});

test("markdown com figura e comando não repetido: figura, texto, comando", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const itens = itensProva([questao("Observe a figura.", { figuras: [f] })]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "figura", "paragrafo", "comando", ...ALTERNATIVAS]);
});

test("enunciado que pede a leitura do texto: texto, figura, crédito e só então o comando", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const q = questao("**Leia o texto a seguir.**\nUm texto.\nSILVA, J. Livro. Acesso em: 1 jan. 2024.\n**Assinale a alternativa correta.**", {
    figuras: [f], origem: "UFGD 2023",
  });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "paragrafo", "paragrafo", "figura", "credito", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[6], { tipo: "comando", segmentos: [{ texto: "Assinale a alternativa correta.", negrito: false, italico: false }], indice: 0, comTexto: true });
});

test("enunciado que pede a leitura com comando em parágrafo em negrito: o resto continua em negrito", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const q = questao("Leia o texto abaixo.\n**Se cada trilho mede 12 m, quantos trilhos?**", { comando: "quantos trilhos?", figuras: [f] });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "paragrafo", "paragrafo", "figura", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[3], { tipo: "paragrafo", segmentos: [{ texto: "Se cada trilho mede 12 m,", negrito: true, italico: false }], indice: 1 });
});

test("markdown sem figura no enunciado: como antes", () => {
  assert.deepEqual(tipos(itensProva([questao("Um texto.")])), ["faixa", "titulo", "paragrafo", "comando", ...ALTERNATIVAS]);
});

test("comando repetido com conteúdo formatado continua sem item comando", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const q = questao("Um texto. Assinale a alternativa correta.", {
    conteudo: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Um texto. Assinale a alternativa correta." }] }] },
    figuras: [f],
  });
  assert.deepEqual(tipos(itensProva([q])), ["faixa", "titulo", "noConteudo", "figura", ...ALTERNATIVAS]);
});

test("marcador da figura com a fonte embaixo: o marcador sai e a fonte vem logo abaixo da figura", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const fonte = "Disponível em: https://operamundi.uol.com.br/permalink/34200. Acesso em: 31 Ago. de 2022.";
  const q = questao(`A charge a seguir ilustra o conflito.\n\n[Charge]\n\n${fonte}\n\nSabe-se que o urânio sofre fissão.`, {
    figuras: [f], origem: "UFGD 2023",
  });
  const itens = itensProva([q]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "figura", "credito", "paragrafo", "paragrafo", "credito", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[3], { tipo: "credito", credito: fonte, origem: null });
  const textos = itens.flatMap((i) => (i.tipo === "paragrafo" ? [i.segmentos.map((s) => s.texto).join("")] : []));
  assert.deepEqual(textos, ["A charge a seguir ilustra o conflito.", "Sabe-se que o urânio sofre fissão."]);
});

test("marcador com descrição e fonte no fim do texto: a fonte sobe para baixo da figura", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const fonte = "Disponível em: http://qnint.sbq.org.br/x. Acesso em: 3 out. 2022.";
  const itens = itensProva([questao(`O paracetamol é sintetizado.\n\n[Figura: reação do p-aminofenol]\n\n${fonte}`, { figuras: [f] })]);
  assert.deepEqual(tipos(itens), ["faixa", "titulo", "figura", "credito", "paragrafo", "comando", ...ALTERNATIVAS]);
  assert.deepEqual(itens[3], { tipo: "credito", credito: fonte, origem: null });
});

test("sem figura, \"[...]\" e matriz: nada muda", () => {
  const f: FiguraRef = { id: "f1", alvo: "enunciado", alinhamento: "centro" };
  const semFigura = itensProva([questao("Texto.\n[Charge]\nDisponível em: x. Acesso em: 1 jan. 2024.\nMais texto.")]);
  assert.deepEqual(tipos(semFigura), ["faixa", "titulo", "paragrafo", "paragrafo", "paragrafo", "paragrafo", "comando", ...ALTERNATIVAS]);
  const comFigura = itensProva([questao("Um trecho.\n[...]\nOutro trecho.\n[1 0 0]", { figuras: [f] })]);
  assert.deepEqual(tipos(comFigura), ["faixa", "titulo", "figura", "paragrafo", "paragrafo", "paragrafo", "paragrafo", "comando", ...ALTERNATIVAS]);
});
