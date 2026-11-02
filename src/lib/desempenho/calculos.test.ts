import { test } from "node:test";
import assert from "node:assert/strict";
import { comparar, evolucao, legendaErro, maisErro, montarPainel, porConteudo, prioridades, resumoGeral } from "./calculos";
import { textoRevisar } from "./regras";
import type { ConteudoDesempenho, RespostaDesempenho } from "./tipos";

let seq = 0;
function r(o: Partial<RespostaDesempenho> = {}): RespostaDesempenho {
  seq += 1;
  return {
    contaId: "c1", tentativaId: "t1", atividadeId: "a1", atividadeTitulo: "Simulado 1", tipo: "professor", entregueEm: "2026-10-01T12:00:00Z",
    questaoId: `q${seq}`, materia: "portugues", assuntoId: "as1", assuntoNome: "Assunto 1", alternativa: "A", correta: true, anulada: false, ...o,
  };
}

function c(o: Partial<ConteudoDesempenho> = {}): ConteudoDesempenho {
  return { chave: "x", materia: "portugues", materiaRotulo: "Português", assuntoId: "x", nome: "X", questoes: 10, acertos: 5, erros: 5, emBranco: 0, taxaErro: 50, legenda: "", ...o };
}

// legendaErro
test("legendaErro: formato básico, em branco, singular e respostas", () => {
  assert.equal(legendaErro({ taxaErro: 70, erros: 7, questoes: 10, emBranco: 0 }), "70% de erro — 7 erros em 10 questões");
  assert.equal(legendaErro({ taxaErro: 70, erros: 7, questoes: 10, emBranco: 2 }), "70% de erro — 7 erros em 10 questões (2 em branco)");
  assert.equal(legendaErro({ taxaErro: 100, erros: 1, questoes: 1, emBranco: 0 }), "100% de erro — 1 erro em 1 questão");
  assert.equal(legendaErro({ taxaErro: 100, erros: 50, questoes: 50, emBranco: 0 }, "respostas"), "100% de erro — 50 erros em 50 respostas");
  assert.equal(legendaErro({ taxaErro: 100, erros: 1, questoes: 1, emBranco: 1 }, "respostas"), "100% de erro — 1 erro em 1 resposta (1 em branco)");
});

// resumoGeral
test("resumoGeral: acerto, erro, em branco e anulada fora", () => {
  const rs = [r(), r({ correta: false, alternativa: "B" }), r({ alternativa: null, correta: false }), r({ anulada: true })];
  assert.deepEqual(resumoGeral(rs), { respondidas: 3, acertos: 1, erros: 1, emBranco: 1, taxaAcerto: 33, refeitas: 0 });
});

test("resumoGeral: conta só a primeira resposta da questão", () => {
  const rs = [
    r({ questaoId: "qq", tentativaId: "t2", entregueEm: "2026-10-05T12:00:00Z", correta: true }),
    r({ questaoId: "qq", tentativaId: "t1", entregueEm: "2026-10-01T12:00:00Z", correta: false, alternativa: "B" }),
  ];
  const s = resumoGeral(rs);
  assert.equal(s.acertos, 0);
  assert.equal(s.erros, 1);
  assert.equal(s.refeitas, 1);
});

test("resumoGeral: na turma, a primeira resposta é por aluno e questão", () => {
  const rs = [r({ contaId: "a", questaoId: "qq" }), r({ contaId: "b", questaoId: "qq", correta: false, alternativa: "B" })];
  assert.equal(resumoGeral(rs).respondidas, 2);
});

// porConteudo
test("porConteudo: questão sem assunto agrupa pela matéria", () => {
  const [g] = porConteudo([r({ materia: "quimica", assuntoId: null, assuntoNome: null, correta: false, alternativa: "B" })]);
  assert.equal(g.nome, "Química (sem assunto)");
  assert.equal(g.chave, "materia:quimica");
  assert.equal(g.taxaErro, 100);
  assert.equal(g.legenda, "100% de erro — 1 erro em 1 questão");
});

test("porConteudo: unidade respostas na legenda", () => {
  const [g] = porConteudo([r({ correta: false, alternativa: "B" })], "respostas");
  assert.equal(g.legenda, "100% de erro — 1 erro em 1 resposta");
});

// prioridades
function conteudoCom(questoes: number, erros: number, brancos = 0): ConteudoDesempenho {
  const rs = Array.from({ length: questoes }, (_, i) =>
    i < erros ? r({ correta: false, alternativa: "B" }) : i < erros + brancos ? r({ alternativa: null, correta: false }) : r(),
  );
  return porConteudo(rs)[0];
}

test("prioridades: 5 questões com 3 erros (60%) → revisar", () => {
  assert.equal(prioridades([conteudoCom(5, 3)])[0].tipo, "revisar");
});
test("prioridades: 5 questões com 2 erros (40%) → nenhuma", () => {
  assert.deepEqual(prioridades([conteudoCom(5, 2)]), []);
});
test("prioridades: 4 questões com 4 erros → mais_respostas", () => {
  assert.equal(prioridades([conteudoCom(4, 4)])[0].tipo, "mais_respostas");
});
test("prioridades: só em branco → nenhuma", () => {
  assert.deepEqual(prioridades([conteudoCom(3, 0, 3)]), []);
});
test("prioridades: 17 questões com 10 erros (59%) → não é revisar", () => {
  assert.equal(prioridades([conteudoCom(17, 10)]).length, 0);
});

test("prioridades: revisar vem antes de mais_respostas", () => {
  const ps = prioridades([conteudoCom(2, 2), conteudoCom(10, 7)]);
  assert.deepEqual(ps.map((p) => p.tipo), ["revisar", "mais_respostas"]);
});
test("textoRevisar: frase sugerida", () => {
  assert.equal(
    textoRevisar({ nome: "Derivação parassintética", erros: 7, questoes: 10 }),
    "Você errou 7 de 10 questões de Derivação parassintética. Vale revisar esse assunto e depois treinar com questões novas.",
  );
});

// evolução e comparação
test("evolucao + comparar: sobe 20 pontos dizendo quais atividades", () => {
  const a = Array.from({ length: 10 }, (_, i) => r({ atividadeId: "s1", atividadeTitulo: "Simulado 1", entregueEm: "2026-10-28T12:00:00Z", correta: i < 4, alternativa: i < 4 ? "A" : "B" }));
  const b = Array.from({ length: 10 }, (_, i) => r({ atividadeId: "t1", atividadeTitulo: "Treino de Química", entregueEm: "2026-11-04T12:00:00Z", correta: i < 6, alternativa: i < 6 ? "A" : "B" }));
  const ev = evolucao([...b, ...a]);
  assert.deepEqual(ev.map((e) => [e.titulo, e.acertos, e.total, e.pct]), [["Simulado 1", 4, 10, 40], ["Treino de Química", 6, 10, 60]]);
  const cmp = comparar(ev)!;
  assert.equal(cmp.diferenca, 20);
  assert.ok(cmp.texto.includes("↑ 20 pontos"));
  assert.ok(cmp.texto.includes("Treino de Química"));
  assert.ok(cmp.texto.includes("Simulado 1"));
  assert.equal(cmp.texto, "↑ 20 pontos: Treino de Química (04/11) comparado com Simulado 1 (28/10)");
});

test("comparar: queda, igual, uma só e nenhuma", () => {
  const ev = (p: number) => ({ atividadeId: String(p), titulo: `A${p}`, entregueEm: "2026-10-28T12:00:00Z", acertos: p, total: 100, pct: p });
  assert.ok(comparar([ev(60), ev(50)])!.texto.startsWith("↓ 10 pontos"));
  assert.ok(comparar([ev(50), ev(50)])!.texto.startsWith("= mesma taxa"));
  assert.equal(comparar([ev(50)]), null);
  assert.deepEqual(evolucao([]), []);
  assert.equal(comparar([]), null);
});

test("atividade só de questões já vistas aparece na evolução, mas não cresce respondidas", () => {
  const base = [r({ questaoId: "q-a", atividadeId: "s1", entregueEm: "2026-10-01T12:00:00Z", correta: false, alternativa: "B" })];
  const refeita = [r({ questaoId: "q-a", tentativaId: "t2", atividadeId: "t9", atividadeTitulo: "Treino", entregueEm: "2026-10-05T12:00:00Z", correta: true })];
  const rs = [...base, ...refeita];
  assert.equal(resumoGeral(rs).respondidas, 1);
  const ev = evolucao(rs);
  assert.equal(ev.length, 2);
  assert.equal(ev[1].pct, 100);
});

// maisErro
test("maisErro: corta em 8 e ignora erros 0", () => {
  const cs = Array.from({ length: 10 }, (_, i) => c({ chave: `k${i}`, nome: `N${i}`, erros: i === 0 ? 0 : 1, taxaErro: 10 + i }));
  const m = maisErro(cs);
  assert.equal(m.length, 8);
  assert.ok(m.every((x) => x.erros > 0));
  assert.equal(m[0].nome, "N9");
});

// montarPainel
test("montarPainel([]) vem vazio", () => {
  assert.deepEqual(montarPainel([]), {
    resumo: { respondidas: 0, acertos: 0, erros: 0, emBranco: 0, taxaAcerto: 0, refeitas: 0 },
    maisErro: [], materias: [], evolucao: [], comparacao: null, prioridades: [], primeiraAtividade: null,
  });
});

test("montarPainel: matérias com pior aproveitamento primeiro", () => {
  const p = montarPainel([r({ materia: "fisica", assuntoId: "f", correta: true }), r({ materia: "quimica", assuntoId: "q", correta: false, alternativa: "B" })]);
  assert.deepEqual(p.materias.map((m) => m.rotulo), ["Química", "Física"]);
  assert.equal(p.primeiraAtividade, "2026-10-01T12:00:00Z");
});
