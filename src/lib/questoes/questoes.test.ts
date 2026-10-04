import { test } from "node:test";
import assert from "node:assert/strict";
import { MATERIAS, areaDaMateria, ehMateria, LETRAS } from "./materias";
import { ASSUNTOS_INICIAIS } from "./assuntos-iniciais";
import { estiloRecorte, limitarQuadro } from "./quadro";
import { markdownParaBlocos } from "./markdown";
import { respostaParaQuestoes, RespostaPaginaSchema, classificacaoParaAtualizacoes } from "./formato-ia";

test("matérias e áreas", () => {
  assert.equal(Object.keys(MATERIAS).length, 14);
  assert.equal(areaDaMateria("fisica"), "natureza");
  assert.equal(areaDaMateria("filosofia"), "humanas");
  assert.equal(areaDaMateria("ingles"), "linguagens");
  assert.equal(ehMateria("fisica"), true);
  assert.equal(ehMateria("astrologia"), false);
  assert.deepEqual([...LETRAS], ["A", "B", "C", "D", "E"]);
  for (const m of Object.keys(MATERIAS)) assert.ok((ASSUNTOS_INICIAIS as Record<string, string[]>)[m].length >= 5, m);
});

test("limitarQuadro mantém o quadro dentro da página", () => {
  assert.deepEqual(limitarQuadro({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual(limitarQuadro({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 }), { x: 0, y: 0.9, w: 0.5, h: 0.1 });
  const q = limitarQuadro({ x: 0.995, y: 0, w: 0.5, h: 0.001 });
  assert.ok(q.w >= 0.01 && q.h >= 0.01 && q.x + q.w <= 1 && q.y + q.h <= 1);
  const nan = limitarQuadro({ x: Number.NaN, y: 0, w: 0.2, h: 0.2 });
  assert.equal(nan.x, 0);
});

test("estiloRecorte calcula fundo e proporção", () => {
  const e = estiloRecorte({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1000, 2000);
  assert.equal(e.backgroundSize, "200% auto");
  assert.equal(e.backgroundPosition, "50% 66.6667%");
  assert.equal(e.aspectRatio, "500 / 500");
  const inteiro = estiloRecorte({ x: 0, y: 0, w: 1, h: 1 }, 800, 1200);
  assert.equal(inteiro.backgroundPosition, "0% 0%");
});

test("markdown seguro: negrito, itálico, linhas, HTML vira texto", () => {
  assert.deepEqual(markdownParaBlocos("Olá **mundo** e *você*"), [[
    { texto: "Olá ", negrito: false, italico: false },
    { texto: "mundo", negrito: true, italico: false },
    { texto: " e ", negrito: false, italico: false },
    { texto: "você", negrito: false, italico: true },
  ]]);
  assert.equal(markdownParaBlocos("linha 1\nlinha 2").length, 2);
  assert.deepEqual(markdownParaBlocos("<script>x</script>"), [[{ texto: "<script>x</script>", negrito: false, italico: false }]]);
  assert.deepEqual(markdownParaBlocos(""), []);
  assert.deepEqual(markdownParaBlocos("a **sem fechar"), [[{ texto: "a **sem fechar", negrito: false, italico: false }]]);
});


const ALT = ["A", "B", "C", "D", "E"].map((letra) => ({ letra, texto: `alt ${letra}` }));
function questaoIA(extra: Record<string, unknown> = {}) {
  return {
    numero: 37, enunciado: "Texto", comando: "Assinale", alternativas: ALT, resposta: "C", anulada: false,
    area: "natureza", materia: "fisica", assunto_id: "as-1", assunto_novo: null, figuras: [], duvidas: [], ...extra,
  };
}
function ctx() {
  return { escopo: "geral" as const, escola_id: null, banca: "UFMS", ano: 2024, caderno: "", importacao_id: "imp", pagina_id: "pag",
    numerosExistentes: new Set<number>(), assuntos: new Map([["as-1", "fisica"], ["as-2", "quimica"]]) };
}

test("IA: questão completa vira linha publicável sem revisão", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA()] }), ctx());
  assert.equal(r.questoes.length, 1);
  const q = r.questoes[0];
  assert.equal(q.linha.numero, 37);
  assert.equal(q.linha.resposta, "C");
  assert.equal(q.linha.precisa_revisao, false);
  assert.equal(q.linha.status, "revisao");
  assert.equal(q.linha.assunto_id, "as-1");
  assert.equal(q.linha.origem, "pdf");
});

test("IA: sem gabarito, dúvidas, assunto novo e assunto de outra matéria pedem revisão", () => {
  const c = ctx();
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [
    questaoIA({ numero: 1, resposta: null }),
    questaoIA({ numero: 2, duvidas: ["imagem cortada"] }),
    questaoIA({ numero: 3, assunto_id: null, assunto_novo: "Gravitação" }),
    questaoIA({ numero: 4, assunto_id: "as-2" }),
    questaoIA({ numero: 5, assunto_id: "nao-existe" }),
  ] }), c);
  assert.deepEqual(r.questoes.map((q) => q.linha.precisa_revisao), [true, true, true, true, true]);
  assert.match(r.questoes[0].linha.motivo_revisao!, /gabarito/i);
  assert.deepEqual(r.questoes[2].assuntoNovo, { materia: "fisica", nome: "Gravitação" });
  assert.equal(r.questoes[3].linha.assunto_id, null);
  assert.equal(r.questoes[4].linha.assunto_id, null);
});

test("IA: anulada sem resposta não pede revisão por gabarito", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ resposta: null, anulada: true })] }), ctx());
  assert.equal(r.questoes[0].linha.precisa_revisao, false);
});

test("IA: figura em alternativa e quadro fora da página são limitados", () => {
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ figuras: [
    { alvo: "enunciado", x: 0.1, y: 0.1, w: 0.5, h: 0.2 },
    { alvo: "B", x: 0.9, y: 0.95, w: 0.5, h: 0.5 },
  ] })] }), ctx());
  const [f1, f2] = r.questoes[0].imagens;
  assert.equal(f1.alvo, "enunciado");
  assert.equal(f2.alvo, "B");
  assert.ok(f2.x + f2.w <= 1 && f2.y + f2.h <= 1);
});

test("IA: número repetido na importação vira aviso, não duplica", () => {
  const c = ctx();
  c.numerosExistentes.add(37);
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA(), questaoIA({ numero: 38 }), questaoIA({ numero: 38 })] }), c);
  assert.deepEqual(r.questoes.map((q) => q.linha.numero), [38]);
  assert.equal(r.avisos.length, 2);
});

test("IA: schema recusa alternativas fora de A–E e matéria inválida", () => {
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ alternativas: ALT.slice(0, 4) })] }).success, true); // aceita, mas marca revisão
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ materia: "astrologia" })] }).success, false);
  assert.equal(RespostaPaginaSchema.safeParse({ questoes: [questaoIA({ resposta: "F" })] }).success, false);
  const r = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA({ alternativas: ALT.slice(0, 4) })] }), ctx());
  assert.equal(r.questoes[0].linha.precisa_revisao, true);
  assert.match(r.questoes[0].linha.motivo_revisao!, /5 alternativas/);
});

test("classificação do enem.dev", () => {
  const ups = classificacaoParaAtualizacoes({ itens: [
    { id: "q1", materia: "fisica", assunto_id: "as-1", assunto_novo: null },
    { id: "q2", materia: "quimica", assunto_id: "as-1", assunto_novo: null },
    { id: "q3", materia: "biologia", assunto_id: null, assunto_novo: "Genética de populações" },
  ] }, new Map([["as-1", "fisica"]]), new Set(["q1", "q2", "q3"]));
  assert.deepEqual(ups.map((u) => [u.id, u.area, u.assunto_id, u.precisa]), [["q1", "natureza", "as-1", false], ["q2", "natureza", null, true], ["q3", "natureza", null, true]]);
  assert.equal(ups[2].assuntoNovo, "Genética de populações");
});

test("IA: enunciado vazio, número inválido, alternativa vazia e falta de assunto pedem revisão", () => {
  const rev = (extra: Record<string, unknown>) => {
    const q = respostaParaQuestoes(RespostaPaginaSchema.parse({ questoes: [questaoIA(extra)] }), ctx()).questoes[0].linha;
    return [q.precisa_revisao, q.motivo_revisao] as const;
  };
  assert.match(rev({ enunciado: "  " })[1]!, /Enunciado vazio/);
  assert.match(rev({ numero: 0 })[1]!, /Número da questão inválido/);
  const altB = ALT.map((a) => (a.letra === "B" ? { ...a, texto: " " } : a));
  assert.match(rev({ alternativas: altB })[1]!, /Alternativa B sem conteúdo/);
  assert.deepEqual(rev({ alternativas: altB, figuras: [{ alvo: "B", x: 0, y: 0, w: 0.5, h: 0.5 }] }), [false, null]);
  assert.match(rev({ assunto_id: null })[1]!, /Sem assunto/);
  assert.deepEqual(rev({ comando: "" }), [false, null]);
});

test("classificação ignora ids desconhecidos e repetidos", () => {
  const ups = classificacaoParaAtualizacoes({ itens: [
    { id: "q1", materia: "fisica", assunto_id: "as-1", assunto_novo: null },
    { id: "zz", materia: "fisica", assunto_id: "as-1", assunto_novo: null },
    { id: "q1", materia: "quimica", assunto_id: null, assunto_novo: null },
  ] }, new Map([["as-1", "fisica"]]), new Set(["q1"]));
  assert.deepEqual(ups.map((u) => [u.id, u.materia]), [["q1", "fisica"]]);
});

import { podeEditarQuestao, podeImportar, podeVerQuestao } from "./regras";

const DONO = { id: "d", role: "dono" as const, escola_id: "e1" };
const ADMIN = { id: "a", role: "admin" as const, escola_id: "e1" };
const PROF = { id: "p", role: "professor" as const, escola_id: "e1" };
const OUTRO = { id: "o", role: "professor" as const, escola_id: "e2" };

test("acesso: banco geral só o dono edita; todos veem publicadas", () => {
  const geral = { escopo: "geral" as const, escola_id: null, criado_por: "d", status: "publicada" as const };
  assert.equal(podeEditarQuestao(DONO, geral), true);
  assert.equal(podeEditarQuestao(ADMIN, geral), false);
  assert.equal(podeEditarQuestao(PROF, geral), false);
  assert.equal(podeVerQuestao(PROF, geral), true);
  assert.equal(podeVerQuestao(PROF, { ...geral, status: "revisao" }), false);
  assert.equal(podeVerQuestao(DONO, { ...geral, status: "revisao" }), true);
});

test("acesso: questão da escola", () => {
  const doProf = { escopo: "escola" as const, escola_id: "e1", criado_por: "p", status: "revisao" as const };
  assert.equal(podeEditarQuestao(PROF, doProf), true);
  assert.equal(podeEditarQuestao({ ...PROF, id: "p2" }, doProf), false);
  assert.equal(podeEditarQuestao(ADMIN, doProf), true);
  assert.equal(podeEditarQuestao(DONO, doProf), true);
  assert.equal(podeEditarQuestao(OUTRO, doProf), false);
  assert.equal(podeVerQuestao(OUTRO, { ...doProf, status: "publicada" }), false);
  assert.equal(podeVerQuestao({ ...PROF, id: "p2" }, { ...doProf, status: "publicada" }), true);
  assert.equal(podeVerQuestao({ ...PROF, id: "p2" }, doProf), false);
});

test("acesso: importar", () => {
  assert.equal(podeImportar(DONO, "geral"), true);
  assert.equal(podeImportar(ADMIN, "geral"), false);
  assert.equal(podeImportar(ADMIN, "escola"), true);
  assert.equal(podeImportar(PROF, "escola"), false);
});

import { enemDevParaQuestao, type EnemDevQuestao } from "./enemdev";

function enem(extra: Partial<EnemDevQuestao> = {}): EnemDevQuestao {
  return {
    title: "Questão 10 - ENEM 2023", index: 10, discipline: "linguagens", language: null, year: 2023,
    context: "Texto **base**\n\n![](https://enem.dev/2023/img1.png)\n\nFonte", files: [],
    correctAlternative: "E", alternativesIntroduction: "Conclui-se que",
    alternatives: ["A", "B", "C", "D", "E"].map((letter) => ({ letter, text: `alt ${letter}`, file: null, isCorrect: letter === "E" })),
    ...extra,
  };
}

test("enem.dev: conversão básica, imagem do markdown extraída", () => {
  const { linha, imagens } = enemDevParaQuestao(enem());
  assert.equal(linha.banca, "ENEM");
  assert.equal(linha.ano, 2023);
  assert.equal(linha.numero, 10);
  assert.equal(linha.caderno, "");
  assert.equal(linha.area, "linguagens");
  assert.equal(linha.resposta, "E");
  assert.equal(linha.comando, "Conclui-se que");
  assert.ok(!linha.enunciado!.includes("!["));
  assert.deepEqual(imagens, [{ alvo: "enunciado", url: "https://enem.dev/2023/img1.png" }]);
  assert.equal(linha.precisa_revisao, false);
  assert.equal(linha.status, "revisao");
});

test("enem.dev: idioma vira caderno; disciplina vira área", () => {
  assert.equal(enemDevParaQuestao(enem({ language: "ingles" })).linha.caderno, "ingles");
  assert.equal(enemDevParaQuestao(enem({ discipline: "ciencias-humanas" })).linha.area, "humanas");
  assert.equal(enemDevParaQuestao(enem({ discipline: "ciencias-natureza" })).linha.area, "natureza");
  assert.equal(enemDevParaQuestao(enem({ discipline: "matematica" })).linha.area, "matematica");
});

test("enem.dev: imagem quebrada e alternativa-imagem", () => {
  const quebrada = enemDevParaQuestao(enem({ context: "x ![](https://enem.dev/broken-image.svg)" }));
  assert.equal(quebrada.linha.precisa_revisao, true);
  assert.match(quebrada.linha.motivo_revisao!, /imagem/i);
  assert.equal(quebrada.imagens.length, 0);
  const alts = ["A", "B", "C", "D", "E"].map((letter) => ({ letter, text: null, file: `https://enem.dev/2023/alt-${letter}.png`, isCorrect: letter === "A" }));
  const r = enemDevParaQuestao(enem({ alternatives: alts, correctAlternative: "A", files: ["https://enem.dev/2023/f.png"] }));
  assert.equal(r.imagens.filter((i) => i.alvo !== "enunciado").length, 5);
  assert.ok(r.imagens.some((i) => i.alvo === "enunciado" && i.url.endsWith("/f.png")));
  assert.equal(r.linha.precisa_revisao, false);
});
