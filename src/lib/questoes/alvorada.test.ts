import { test } from "node:test";
import assert from "node:assert/strict";
import { anoDaProva, converterLinha, decidirClassificacao, idiomaDoTexto, lerCsv, separarRepetidas, type LinhaAlvorada } from "./alvorada";

const base: LinhaAlvorada = {
  question_id: "exams_pt-br_fuvest_2008_q_18",
  question_number: "18",
  subject: "Física",
  question_statement: "Três esferas metálicas, de mesmo diâmetro e montadas em suportes isolantes, estão bem afastadas entre si.\nApós as operações, as cargas serão",
  correct_answer: "b",
  exam_name: "exams_pt-br_fuvest_2008",
  exam_year: "2008",
  exam_type: "fuvest",
  alternative_a: "Q/2", alternative_b: "3Q/4", alternative_c: "2Q/3", alternative_d: "Q", alternative_e: "zero",
};
const linha = (mudar: Partial<LinhaAlvorada>) => ({ ...base, ...mudar });

test("lerCsv: aspas com vírgula, quebra de linha e aspas escapadas", () => {
  const csv = 'a,b,c\n1,"x, y","linha 1\nlinha 2"\n2,"diz ""oi""",\n';
  assert.deepEqual(lerCsv(csv), [{ a: "1", b: "x, y", c: "linha 1\nlinha 2" }, { a: "2", b: 'diz "oi"', c: "" }]);
});

test("converterLinha: questão limpa entra publicada, com origem dataset e fonte_id", () => {
  const c = converterLinha(base)!;
  assert.equal(c.linha.banca, "FUVEST");
  assert.equal(c.linha.ano, 2008);
  assert.equal(c.linha.numero, 18);
  assert.equal(c.linha.materia, "fisica");
  assert.equal(c.linha.area, "natureza");
  assert.equal(c.linha.resposta, "B");
  assert.equal(c.linha.status, "publicada");
  assert.equal(c.linha.precisa_revisao, false);
  assert.equal(c.linha.origem, "dataset");
  assert.equal(c.linha.fonte_id, "alvorada:exams_pt-br_fuvest_2008_q_18");
  assert.equal(c.linha.escopo, "geral");
  assert.ok((c.linha.enunciado as string).includes("\nApós"), "preserva a quebra de linha");
  assert.equal(c.chave, "FUVEST|2008||18");
});

test("converterLinha: 4 alternativas (UNICAMP) e 'nan' viram E vazia, sem revisão", () => {
  const c = converterLinha(linha({ exam_type: "unicamp", exam_name: "unicamp_2015", alternative_e: "nan" }))!;
  assert.equal(c.linha.alternativas![4].texto, "");
  assert.equal(c.linha.status, "publicada");
});

test("converterLinha: problemas viram revisão com o motivo, sem corrigir", () => {
  const fig = converterLinha(linha({ question_statement: "Observe o gráfico abaixo, que mostra a variação da temperatura ao longo do dia na cidade." }))!;
  assert.equal(fig.linha.status, "revisao");
  assert.match(fig.linha.motivo_revisao!, /cita figura/);
  assert.match(converterLinha(linha({ alternative_c: "3q/4 " }))!.linha.motivo_revisao!, /repetidas/);
  assert.match(converterLinha(linha({ correct_answer: "x" }))!.linha.motivo_revisao!, /Gabarito fora/);
  assert.match(converterLinha(linha({ correct_answer: "e", alternative_e: "" }))!.linha.motivo_revisao!, /alternativa vazia/);
  assert.match(converterLinha(linha({ question_statement: "Calcule." }))!.linha.motivo_revisao!, /curto/);
  assert.match(converterLinha(linha({ alternative_a: "ଵଽ" }))!.linha.motivo_revisao!, /estranhos/);
  assert.match(converterLinha(linha({ subject: "Ciências Humanas" }))!.linha.motivo_revisao!, /genérica/);
  assert.match(converterLinha(linha({ alternative_d: "", alternative_e: "" }))!.linha.motivo_revisao!, /Só 3/);
});

test("anoDaProva: ITA separado por matéria pega o ano do nome (o exam_year vem errado)", () => {
  assert.equal(anoDaProva({ exam_name: "ita_2008-fisica", exam_year: "2024" }), 2008);
  const c = converterLinha(linha({ exam_type: "ita", exam_name: "ita_2008-fisica", exam_year: "2024" }))!;
  assert.equal(c.linha.ano, 2008);
  assert.equal(c.linha.caderno, "fisica");
});

test("idiomaDoTexto e caderno do ENEM: espanhol rotulado como Inglês vira espanhol", () => {
  assert.equal(idiomaDoTexto("El tango ya sea como danza, música, poesía o expresión de los porteños es parte de la cultura"), "espanhol");
  assert.equal(idiomaDoTexto("The United Nations warns that this is one of the worst disasters in the history of the country"), "ingles");
  const c = converterLinha(linha({ exam_type: "enem", exam_name: "enem_2011-2", subject: "Inglês", question_number: "94", question_statement: "El tango ya sea como danza, música, poesía o expresión de los porteños es parte de la cultura del país." }))!;
  assert.equal(c.linha.materia, "espanhol");
  assert.equal(c.linha.caderno, "espanhol");
  assert.equal(c.chave, "ENEM|2011|espanhol|94");
});

test("separarRepetidas: segunda com o mesmo número fica sem número, em revisão, e com fonte_id distinto", () => {
  const a = converterLinha(base)!;
  const b = converterLinha(linha({ question_statement: "Outra questão com o mesmo número, texto completamente diferente do primeiro." }))!;
  const [p, s] = separarRepetidas([a, b]);
  assert.equal(p.linha.numero, 18);
  assert.equal(p.linha.status, "publicada");
  assert.equal(s.linha.numero, null);
  assert.equal(s.linha.status, "revisao");
  assert.match(s.linha.motivo_revisao!, /repetido no dataset/);
  assert.equal(s.linha.fonte_id, "alvorada:exams_pt-br_fuvest_2008_q_18#2");
});

test("converterLinha: banca fora da lista é ignorada", () => {
  assert.equal(converterLinha(linha({ exam_type: "outra" })), null);
});

test("decidirClassificacao: mesma área refina a matéria; outra área mantém a do dataset sem assunto", () => {
  const ia = (materia: string, area: "linguagens" | "humanas") => ({ materia, area, assunto_id: "as-1", assuntoNovo: null });
  const port = { materia: "portugues", area: "linguagens" as const, motivo_revisao: null };
  assert.deepEqual(decidirClassificacao(port, ia("literatura", "linguagens")), { ...ia("literatura", "linguagens"), aviso: null });
  const outra = decidirClassificacao(port, ia("historia", "humanas"));
  assert.equal(outra.materia, "portugues");
  assert.equal(outra.assunto_id, null);
  assert.match(outra.aviso!, /historia/);
  const generica = { materia: "historia", area: "humanas" as const, motivo_revisao: 'Matéria genérica no dataset ("Ciências Humanas"): confira a matéria.' };
  assert.equal(decidirClassificacao(generica, ia("sociologia", "humanas")).materia, "sociologia");
});
