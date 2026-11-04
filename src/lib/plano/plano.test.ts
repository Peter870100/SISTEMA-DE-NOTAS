import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPlano, ordenarComPrerequisitos } from "./plano";
import { REGRAS_PADRAO } from "./regras";
import type { ConteudoPlano, EntradaPlano, Plano, TreinoDoPlano } from "./tipos";
import type { ConteudoDesempenho, Prioridade } from "@/lib/desempenho/tipos";

const agora = new Date("2026-11-03T12:00:00Z");
const cd = (chave: string, o: Partial<ConteudoDesempenho> = {}): ConteudoDesempenho => ({
  chave, materia: "matematica", materiaRotulo: "Matemática", assuntoId: chave, nome: `Assunto ${chave}`,
  questoes: 10, acertos: 3, erros: 7, emBranco: 0, taxaErro: 70, legenda: "7 erros em 10 questões", foco: null, topicos: [], ...o,
});
const pri = (c: ConteudoDesempenho, tipo: Prioridade["tipo"] = "revisar"): Prioridade => ({ tipo, conteudo: c, texto: "" });
const tr = (o: Partial<TreinoDoPlano> = {}): TreinoDoPlano => ({
  simuladoId: "s1", conteudo: "a", etapa: "pratica", rodada: 1, criadoEm: "2026-10-01T10:00:00.000Z",
  entregueEm: null, acertos: null, total: null, ...o,
});
const plano = (o: Partial<EntradaPlano> = {}): Plano =>
  montarPlano({ conteudos: [], prioridades: [], treinos: [], revisadoEm: {}, minutosRevisar: {}, prerequisitos: {}, minutosSemana: null, regras: REGRAS_PADRAO, agora, ...o });
const todos = (p: Plano) => [...p.semana, ...p.depois, ...p.concluidos];
/** Plano com um só conteúdo "a" (prioridade revisar); devolve esse conteúdo. */
function so(o: Partial<EntradaPlano> = {}): ConteudoPlano {
  const a = cd("a");
  const t = todos(plano({ conteudos: [a], prioridades: [pri(a)], ...o }));
  assert.equal(t.length, 1);
  return t[0];
}
const estados = (c: ConteudoPlano) => c.etapas.map((e) => e.estado);
const chaves = (cs: ConteudoPlano[]) => cs.map((c) => c.chave);
const AVISO = "Vamos de novo: revise e pratique com questões novas.";

const praticaOk = tr({ simuladoId: "p1", criadoEm: "2026-10-20T10:00:00.000Z", entregueEm: "2026-10-20T12:00:00.000Z", acertos: 4, total: 5 });
const revisaoOk = tr({ simuladoId: "r1", etapa: "revisao", criadoEm: "2026-10-28T10:00:00.000Z", entregueEm: "2026-10-28T12:00:00.000Z", acertos: 3, total: 3 });

test("conteúdo novo: revisar e praticar disponíveis, revisão aguardando", () => {
  const a = cd("a");
  const p = plano({ conteudos: [a], prioridades: [pri(a)] });
  assert.equal(p.semana.length, 1);
  const c = p.semana[0];
  assert.deepEqual(c.etapas.map((e) => e.tipo), ["revisar", "pratica", "revisao"]);
  assert.deepEqual(estados(c), ["disponivel", "disponivel", "aguardando"]);
  assert.deepEqual(c.etapas.map((e) => e.minutos), [15, 15, 9]);
  assert.deepEqual(c.etapas.map((e) => e.disponivelEm), [null, null, null]);
  assert.deepEqual(c.etapas.map((e) => e.treinoAberto), [null, null, null]);
  assert.deepEqual(c.etapas.map((e) => e.resultado), [null, null, null]);
  assert.equal(c.feitas, 0);
  assert.equal(c.total, 3);
  assert.equal(c.etiqueta, "Revisão prioritária");
  assert.equal(c.situacao, "revisar");
  assert.equal(c.rodada, 1);
  assert.equal(c.aviso, null);
  assert.equal(c.minutosProximos, 30);
  assert.equal(c.depois, null);
  assert.deepEqual(c.historico, { diagnosticos: 0, praticas: 0, revisoes: 0 });
  assert.equal(c.texto, "Você errou 7 de 10 questões de Assunto a. Revise esse conteúdo e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.equal(c.chave, "a");
  assert.equal(c.materia, "matematica");
  assert.equal(c.materiaRotulo, "Matemática");
  assert.equal(c.assuntoId, "a");
  assert.equal(c.nome, "Assunto a");
  assert.equal(c.inicial, a);
  assert.equal(c.foco, null);
  assert.deepEqual(p.progresso, { feitas: 0, total: 3, pct: 0 });
  assert.equal(p.minutosDaSemana, 30);
  assert.equal(p.criterio, "Sugestão pelo critério: 5 ou mais questões e 60% ou mais de erro. Um resultado isolado não comprova uma dificuldade.");
});

test("texto com foco usa o tópico e devolve o foco", () => {
  const foco = { topicoId: "t1", nome: "Derivação parassintética", erros: 4, questoes: 5 };
  const a = cd("a", { nome: "Morfologia", foco });
  const c = plano({ conteudos: [a], prioridades: [pri(a)] }).semana[0];
  assert.equal(c.texto, "Você errou 7 de 10 questões de Morfologia, 4 delas sobre Derivação parassintética. Revise esse tópico e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
  assert.deepEqual(c.foco, foco);
});

test("minutos seguem as regras da escola e a duração do material", () => {
  const regras = { ...REGRAS_PADRAO, minutosPorQuestao: 2, minutosMaterial: 20, questoesPratica: 10, questoesRevisao: 4 };
  assert.deepEqual(so({ regras }).etapas.map((e) => e.minutos), [20, 20, 8]);
  const c = so({ minutosRevisar: { a: 25 } });
  assert.deepEqual(c.etapas.map((e) => e.minutos), [25, 15, 9]);
  assert.equal(c.minutosProximos, 40);
});

test("\"Já revisei\" sem treino: etapa 1 feita", () => {
  const c = so({ revisadoEm: { a: "2026-11-02T10:00:00.000Z" } });
  assert.deepEqual(estados(c), ["feita", "disponivel", "aguardando"]);
  assert.equal(c.feitas, 1);
  assert.equal(c.minutosProximos, 15);
  assert.equal(c.etiqueta, "Revisão prioritária");
});

test("prática entregue 4/5: etapa 2 feita e revisão aguardando a data", () => {
  const pratica = tr({ simuladoId: "p1", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 4, total: 5 });
  const c = so({ treinos: [pratica] });
  assert.deepEqual(estados(c), ["disponivel", "feita", "aguardando"]);
  assert.deepEqual(c.etapas[1].resultado, { acertos: 4, total: 5 });
  assert.equal(c.etapas[2].disponivelEm, "2026-11-08T12:00:00.000Z");
  assert.equal(c.rodada, 1);
  assert.equal(c.etiqueta, "Revisão prioritária");
  assert.equal(c.minutosProximos, 15);
  assert.deepEqual(c.depois, { acertos: 4, total: 5 });
  assert.deepEqual(c.historico, { diagnosticos: 0, praticas: 1, revisoes: 0 });

  const depois = so({ treinos: [pratica], agora: new Date("2026-11-09T12:00:00Z") });
  assert.deepEqual(estados(depois), ["disponivel", "feita", "disponivel"]);
  assert.equal(depois.etiqueta, "Revisão posterior liberada");
  assert.equal(depois.minutosProximos, 24);

  assert.equal(so({ treinos: [pratica], agora: new Date("2026-11-08T12:00:00.000Z") }).etapas[2].estado, "disponivel");
  assert.equal(so({ treinos: [pratica], agora: new Date("2026-11-08T11:59:59.999Z") }).etapas[2].estado, "aguardando");
});

test("prática no limite da meta passa; acima da meta da escola não", () => {
  const pratica = tr({ entregueEm: "2026-11-01T12:00:00.000Z", acertos: 3, total: 5 });
  assert.equal(so({ treinos: [pratica] }).etapas[1].estado, "feita");
  const c = so({ treinos: [pratica], regras: { ...REGRAS_PADRAO, metaAcerto: 70 } });
  assert.equal(c.rodada, 2);
  assert.equal(c.etapas[1].estado, "disponivel");
});

test("prática entregue 2/5: nova rodada e revisão antiga não vale", () => {
  const falhou = tr({ entregueEm: "2026-11-01T12:00:00.000Z", acertos: 2, total: 5 });
  const c = so({ treinos: [falhou], revisadoEm: { a: "2026-10-31T00:00:00.000Z" } });
  assert.equal(c.rodada, 2);
  assert.equal(c.etiqueta, "Rodada 2");
  assert.equal(c.aviso, AVISO);
  assert.deepEqual(estados(c), ["disponivel", "disponivel", "aguardando"]);
  assert.deepEqual(c.etapas[1].resultado, { acertos: 2, total: 5 });
  assert.equal(c.etapas[2].disponivelEm, null);
  assert.equal(c.situacao, "revisar");

  assert.equal(so({ treinos: [falhou], revisadoEm: { a: "2026-11-02T00:00:00.000Z" } }).etapas[0].estado, "feita");
  assert.equal(so({ treinos: [falhou], revisadoEm: { a: "2026-11-01T12:00:00.000Z" } }).etapas[0].estado, "disponivel");
});

test("resultado nulo ou total zero não passa", () => {
  const c = so({ treinos: [tr({ entregueEm: "2026-11-01T12:00:00.000Z", acertos: null, total: null })] });
  assert.equal(c.rodada, 2);
  assert.deepEqual(c.etapas[1].resultado, { acertos: 0, total: 0 });
  assert.deepEqual(c.depois, { acertos: 0, total: 0 });
  assert.equal(so({ treinos: [tr({ entregueEm: "2026-11-01T12:00:00.000Z", acertos: 0, total: 0 })] }).rodada, 2);
});

test("revisão abaixo da meta: nova rodada", () => {
  const revisaoRuim = tr({ simuladoId: "r1", etapa: "revisao", entregueEm: "2026-10-28T12:00:00.000Z", acertos: 1, total: 3 });
  const c = so({ treinos: [praticaOk, revisaoRuim], revisadoEm: { a: "2026-10-25T00:00:00.000Z" } });
  assert.equal(c.rodada, 2);
  assert.equal(c.etiqueta, "Rodada 2");
  assert.equal(c.aviso, AVISO);
  assert.deepEqual(estados(c), ["disponivel", "disponivel", "aguardando"]);
  assert.deepEqual(c.etapas[1].resultado, { acertos: 4, total: 5 });
  assert.deepEqual(c.etapas[2].resultado, { acertos: 1, total: 3 });
  assert.equal(c.etapas[2].disponivelEm, null);
  assert.deepEqual(c.depois, { acertos: 5, total: 8 });
});

test("revisão sem prática aprovada é ignorada", () => {
  const c = so({ treinos: [tr({ etapa: "revisao", entregueEm: "2026-10-28T12:00:00.000Z", acertos: 3, total: 3 })] });
  assert.equal(c.situacao, "revisar");
  assert.equal(c.rodada, 1);
  assert.deepEqual(estados(c), ["disponivel", "disponivel", "aguardando"]);
  assert.deepEqual(c.historico, { diagnosticos: 0, praticas: 0, revisoes: 1 });
});

test("revisão entregue 3/3 depois da prática 4/5: concluído", () => {
  const a = cd("a");
  for (const treinos of [[praticaOk, revisaoOk], [revisaoOk, praticaOk]]) {
    const p = plano({ conteudos: [a], prioridades: [pri(a)], treinos });
    assert.deepEqual(p.semana, []);
    assert.deepEqual(p.depois, []);
    assert.equal(p.concluidos.length, 1);
    const c = p.concluidos[0];
    assert.equal(c.situacao, "concluido");
    assert.equal(c.etiqueta, "Concluído");
    assert.equal(c.aviso, null);
    assert.deepEqual(estados(c), ["feita", "feita", "feita"]);
    assert.deepEqual(c.etapas[2].resultado, { acertos: 3, total: 3 });
    assert.deepEqual(c.depois, { acertos: 7, total: 8 });
    assert.equal(c.feitas, 3);
    assert.equal(c.total, 3);
    assert.equal(c.minutosProximos, 0);
    assert.deepEqual(p.progresso, { feitas: 3, total: 3, pct: 100 });
    assert.equal(p.minutosDaSemana, 0);
  }
});

test("concluído + prática aberta: volta para a semana na rodada 2", () => {
  const aberta = tr({ simuladoId: "p2", criadoEm: "2026-11-02T09:00:00.000Z" });
  const p = plano({ conteudos: [cd("a")], prioridades: [pri(cd("a"))], treinos: [praticaOk, revisaoOk, aberta], revisadoEm: { a: "2026-10-15T00:00:00.000Z" } });
  assert.deepEqual(p.concluidos, []);
  assert.equal(p.semana.length, 1);
  const c = p.semana[0];
  assert.equal(c.situacao, "revisar");
  assert.equal(c.rodada, 2);
  assert.equal(c.etiqueta, "Rodada 2");
  assert.equal(c.etapas[1].treinoAberto, "p2");
  assert.deepEqual(estados(c), ["disponivel", "disponivel", "aguardando"]);
  assert.equal(c.etapas[2].disponivelEm, null);
  assert.deepEqual(c.etapas[1].resultado, { acertos: 4, total: 5 });

  const revisou = so({ treinos: [praticaOk, revisaoOk, aberta], revisadoEm: { a: "2026-11-02T10:00:00.000Z" } });
  assert.equal(revisou.etapas[0].estado, "feita");
});

test("concluído + prática entregue: nova rodada (passou fica na 2, reprovou vai à 3)", () => {
  const nova = { simuladoId: "p2", criadoEm: "2026-11-01T09:00:00.000Z", entregueEm: "2026-11-01T12:00:00.000Z" };
  const passou = so({ treinos: [praticaOk, revisaoOk, tr({ ...nova, acertos: 5, total: 5 })] });
  assert.equal(passou.situacao, "revisar");
  assert.equal(passou.rodada, 2);
  assert.deepEqual(estados(passou), ["disponivel", "feita", "aguardando"]);
  assert.equal(passou.etapas[2].disponivelEm, "2026-11-08T12:00:00.000Z");
  assert.deepEqual(passou.depois, { acertos: 12, total: 13 });
  const reprovou = so({ treinos: [praticaOk, revisaoOk, tr({ ...nova, acertos: 1, total: 5 })] });
  assert.equal(reprovou.rodada, 3);
  assert.equal(reprovou.etiqueta, "Rodada 3");
  assert.deepEqual(estados(reprovou), ["disponivel", "disponivel", "aguardando"]);
});

test("mais respostas: uma etapa de diagnóstico", () => {
  const m = cd("m", { questoes: 3, acertos: 1, erros: 2, taxaErro: 67 });
  const treinos = [
    tr({ simuladoId: "d1", conteudo: "m", etapa: "diagnostico", entregueEm: "2026-10-10T12:00:00.000Z", acertos: 3, total: 5 }),
    tr({ simuladoId: "d2", conteudo: "m", etapa: "diagnostico", entregueEm: "2026-10-20T12:00:00.000Z", acertos: 2, total: 5 }),
    tr({ simuladoId: "d3", conteudo: "m", etapa: "diagnostico", criadoEm: "2026-11-01T10:00:00.000Z" }),
  ];
  const p = plano({ conteudos: [m], prioridades: [pri(m, "mais_respostas")], treinos });
  const c = p.semana[0];
  assert.equal(c.situacao, "mais_respostas");
  assert.equal(c.etiqueta, "Precisamos de mais respostas");
  assert.deepEqual(c.etapas, [{ tipo: "diagnostico", estado: "disponivel", minutos: 15, disponivelEm: null, treinoAberto: "d3", resultado: { acertos: 2, total: 5 } }]);
  assert.deepEqual(c.historico, { diagnosticos: 2, praticas: 0, revisoes: 0 });
  assert.equal(c.feitas, 0);
  assert.equal(c.total, 1);
  assert.equal(c.minutosProximos, 15);
  assert.equal(c.rodada, 1);
  assert.equal(c.aviso, null);
  assert.equal(c.depois, null);
  assert.equal(c.texto, "Você respondeu só 3 questões de Assunto m e errou 2. Precisamos de mais respostas: resolva 5 questões de diagnóstico para entender melhor.");
  assert.deepEqual(p.progresso, { feitas: 0, total: 1, pct: 0 });

  const semTreino = plano({ conteudos: [m], prioridades: [pri(m, "mais_respostas")] }).semana[0];
  assert.equal(semTreino.etapas[0].treinoAberto, null);
  assert.equal(semTreino.etapas[0].resultado, null);
  assert.deepEqual(semTreino.historico, { diagnosticos: 0, praticas: 0, revisoes: 0 });
});

test("mais respostas com prática vira revisar, com o texto de revisar", () => {
  const m = cd("m", { questoes: 3, acertos: 1, erros: 2, taxaErro: 67 });
  const c = plano({ conteudos: [m], prioridades: [pri(m, "mais_respostas")], treinos: [tr({ simuladoId: "p9", conteudo: "m" })] }).semana[0];
  assert.equal(c.situacao, "revisar");
  assert.equal(c.etapas.length, 3);
  assert.equal(c.etapas[1].treinoAberto, "p9");
  assert.equal(c.etiqueta, "Revisão prioritária");
  assert.equal(c.texto, "Você errou 2 de 3 questões de Assunto m. Revise esse conteúdo e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
});

test("quem entra: prioridades e chaves com prática ou revisão que têm desempenho", () => {
  const a = cd("a"), b = cd("b"), x = cd("x"), y = cd("y");
  const p = plano({
    conteudos: [a, b, x, y],
    prioridades: [pri(a)],
    treinos: [
      tr({ conteudo: "b", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 4, total: 5 }),
      tr({ conteudo: "fantasma", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 4, total: 5 }),
      tr({ conteudo: "x", etapa: "diagnostico", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 1, total: 5 }),
    ],
  });
  assert.deepEqual(chaves(todos(p)).sort(), ["a", "b"]);
  const b2 = todos(p).find((c) => c.chave === "b")!;
  assert.equal(b2.situacao, "revisar");
  assert.equal(b2.etiqueta, "Revisão prioritária");
  assert.equal(b2.texto, "Você errou 7 de 10 questões de Assunto b. Revise esse conteúdo e depois resolva uma sequência de 5 questões, começando pelas mais simples.");
});

test("ordem: revisão liberada, em andamento, revisar novo, diagnóstico", () => {
  const lib = cd("lib"), rod = cd("rod"), abe = cd("abe"), and = cd("and"), nov = cd("nov"), dia = cd("dia", { questoes: 2, acertos: 1, erros: 1 });
  const p = plano({
    conteudos: [lib, rod, abe, and, nov, dia],
    prioridades: [pri(nov), pri(rod), pri(abe), pri(and), pri(lib), pri(dia, "mais_respostas")],
    treinos: [
      tr({ conteudo: "lib", entregueEm: "2026-10-20T12:00:00.000Z", acertos: 4, total: 5 }),
      tr({ conteudo: "rod", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 1, total: 5 }),
      tr({ simuladoId: "x1", conteudo: "abe" }),
    ],
    revisadoEm: { and: "2026-11-01T00:00:00.000Z" },
    minutosSemana: 480,
  });
  assert.deepEqual(chaves(p.semana), ["lib", "rod", "abe", "and", "nov", "dia"]);
  assert.deepEqual(p.depois, []);
});

test("ordem: no mesmo grupo, prioridades primeiro e as demais pelo nome", () => {
  const n = cd("n", { nome: "Frações" }), p1 = cd("p1", { nome: "Porcentagem" }), z = cd("z", { nome: "Zebra" }), y = cd("y", { nome: "Árvore" });
  const p = plano({
    conteudos: [n, p1, z, y],
    prioridades: [pri(n), pri(p1)],
    treinos: [tr({ simuladoId: "tz", conteudo: "z" }), tr({ simuladoId: "ty", conteudo: "y" })],
    revisadoEm: { p1: "2026-11-01T00:00:00.000Z" },
    minutosSemana: 480,
  });
  assert.deepEqual(chaves(p.semana), ["p1", "y", "z", "n"]);
});

test("ordem: pré-requisito do plano vem antes de quem depende dele", () => {
  const a = cd("a"), b = cd("b");
  const p = plano({ conteudos: [a, b], prioridades: [pri(a), pri(b)], prerequisitos: { a: ["b", "fora"] }, minutosSemana: 480 });
  assert.deepEqual(chaves(p.semana), ["b", "a"]);
});

test("ordenarComPrerequisitos", () => {
  assert.deepEqual(ordenarComPrerequisitos(["a", "b", "c"], { a: ["c"] }), ["c", "a", "b"]);
  assert.deepEqual(ordenarComPrerequisitos(["c", "a", "b"], { a: ["c"] }), ["c", "a", "b"]);
  assert.deepEqual(ordenarComPrerequisitos(["a", "b", "c"], { a: ["c"], b: ["c"] }), ["c", "a", "b"]);
  assert.deepEqual(ordenarComPrerequisitos(["a", "b", "c"], { a: ["b"], b: ["c"] }), ["c", "b", "a"]);
  assert.deepEqual(ordenarComPrerequisitos(["a"], { a: ["x", "a"] }), ["a"]);
  const entrada = ["a", "b", "c"];
  ordenarComPrerequisitos(entrada, { a: ["c"] });
  assert.deepEqual(entrada, ["a", "b", "c"]);
});

test("ordenarComPrerequisitos: laço não trava e devolve as chaves uma vez", () => {
  const r = ordenarComPrerequisitos(["a", "b"], { a: ["b"], b: ["a"] });
  assert.equal(r.length, 2);
  assert.deepEqual([...r].sort(), ["a", "b"]);
});

test("semana: com 30 min e dois conteúdos de 30, o segundo fica para depois", () => {
  const a = cd("a"), b = cd("b");
  const p = plano({ conteudos: [a, b], prioridades: [pri(a), pri(b)], minutosSemana: 30 });
  assert.deepEqual(chaves(p.semana), ["a"]);
  assert.deepEqual(chaves(p.depois), ["b"]);
  assert.equal(p.minutosDaSemana, 30);
  assert.equal(p.minutosSemana, 30);
  assert.equal(p.tempoEscolhido, true);
  assert.deepEqual(chaves(plano({ conteudos: [a, b], prioridades: [pri(a), pri(b)], minutosSemana: 60 }).semana), ["a", "b"]);
});

test("semana: o primeiro entra mesmo maior que o tempo", () => {
  const a = cd("a"), b = cd("b");
  const p = plano({ conteudos: [a, b], prioridades: [pri(a), pri(b)], minutosRevisar: { a: 30 }, minutosSemana: 30 });
  assert.deepEqual(chaves(p.semana), ["a"]);
  assert.deepEqual(chaves(p.depois), ["b"]);
  assert.equal(p.minutosDaSemana, 45);
});

test("semana: conteúdo só com revisão aguardando vai para depois", () => {
  const w = cd("w"), n = cd("n");
  const p = plano({
    conteudos: [w, n], prioridades: [pri(w), pri(n)],
    treinos: [tr({ conteudo: "w", entregueEm: "2026-11-01T12:00:00.000Z", acertos: 4, total: 5 })],
    revisadoEm: { w: "2026-10-31T00:00:00.000Z" },
  });
  assert.equal(todos(p).find((c) => c.chave === "w")!.minutosProximos, 0);
  assert.deepEqual(chaves(p.semana), ["n"]);
  assert.deepEqual(chaves(p.depois), ["w"]);
  assert.equal(p.minutosDaSemana, 30);
});

test("semana: depois do primeiro que não cabe, todos vão para depois", () => {
  const a = cd("a"), b = cd("b"), c = cd("c");
  const p = plano({ conteudos: [a, b, c], prioridades: [pri(a), pri(b), pri(c)], minutosRevisar: { b: 85, c: 5 }, minutosSemana: 120 });
  assert.deepEqual(chaves(p.semana), ["a"]);
  assert.deepEqual(chaves(p.depois), ["b", "c"]);
  assert.equal(p.minutosDaSemana, 30);
});

test("semana: sem tempo escolhido vale 120", () => {
  const p = plano({ minutosSemana: null });
  assert.equal(p.minutosSemana, 120);
  assert.equal(p.tempoEscolhido, false);
  assert.deepEqual(p.semana, []);
  assert.deepEqual(p.depois, []);
  assert.deepEqual(p.concluidos, []);
  assert.deepEqual(p.progresso, { feitas: 0, total: 0, pct: 0 });
  assert.equal(p.minutosDaSemana, 0);
});

test("progresso soma as etapas de todos, com os concluídos completos", () => {
  const a = cd("a"), b = cd("b"), m = cd("m", { questoes: 2, acertos: 1, erros: 1 });
  const p = plano({
    conteudos: [a, b, m], prioridades: [pri(a), pri(b), pri(m, "mais_respostas")],
    treinos: [{ ...praticaOk, conteudo: "b" }, { ...revisaoOk, conteudo: "b" }],
  });
  assert.deepEqual(chaves(p.concluidos), ["b"]);
  assert.deepEqual(p.progresso, { feitas: 3, total: 7, pct: 43 });
});
