import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acertoPorMateria,
  agruparAlunoEntreBimestres,
  distribuicaoMedias,
  formatarNecessaria,
  fraseAluno,
  fraseTurma,
  quantoFalta,
  rankingTurma,
  resumoAulas,
  situacaoNoSimulado,
} from "./calculos";
import type { BimestreAluno, LinhaSimuladoAluno, RelatorioAluno, RelatorioTurma } from "./tipos";

function bims(medias: (number | null)[], encerrados = medias.length): BimestreAluno[] {
  return medias.map((media, i) => ({ bimestre: `${i + 1}º Bimestre`, turmaId: `t${i + 1}`, media, encerrado: i < encerrados, vigente: i === encerrados }));
}

// quantoFalta
test("quantoFalta: 5 e 6 encerrados, média 6 → precisa de 6,5", () => {
  const r = quantoFalta(bims([5, 6]), 6);
  assert.equal(r.situacao, "precisa");
  assert.equal(r.porBimestre, 6.5);
  assert.equal(r.mediaAtual, 5.5);
});

// O brief pedia [9, 9] → atingiu, mas pela fórmula da spec ainda faltam 3,0 em cada um dos 2 restantes
// (9, 9, 0, 0 daria 4,5): dizer "atingiu" seria enganoso. Atingiu = precisa de ≤ 0, ex.: 9, 9, 9.
test("quantoFalta: 9, 9 e 9 → atingiu (precisaria de −3); 9 e 9 ainda precisa de 3,0", () => {
  const r = quantoFalta(bims([9, 9, 9]), 6);
  assert.equal(r.situacao, "atingiu");
  assert.equal(r.mediaAtual, 9);
  assert.equal(r.porBimestre, undefined);
  assert.deepEqual(quantoFalta(bims([9, 9]), 6), { situacao: "precisa", porBimestre: 3, mediaAtual: 9 });
});

// O brief dizia "precisaria de 12", mas (6 × 4 − 6) ÷ 1 = 18. Com 2 e 2: (24 − 4) ÷ 2 = 10 (ainda possível).
test("quantoFalta: 2, 2, 2 → impossível (precisaria de 18)", () => {
  const r = quantoFalta(bims([2, 2, 2]), 6);
  assert.equal(r.situacao, "impossivel");
  assert.equal(r.porBimestre, 18);
  assert.equal(quantoFalta(bims([2, 2]), 6).situacao, "precisa");
});

test("quantoFalta: 4 encerrados abaixo da média → não atingiu (não impossível)", () => {
  const r = quantoFalta(bims([5, 5, 5, 5]), 6);
  assert.equal(r.situacao, "nao_atingiu");
  assert.equal(r.mediaAtual, 5);
});

test("quantoFalta: 4 encerrados na média → atingiu", () => {
  assert.equal(quantoFalta(bims([6, 6, 6, 6]), 6).situacao, "atingiu");
});

test("quantoFalta: nenhum encerrado → sem dados", () => {
  assert.deepEqual(quantoFalta(bims([8], 0), 6), { situacao: "sem_dados" });
  assert.deepEqual(quantoFalta([], 6), { situacao: "sem_dados" });
});

test("quantoFalta: bimestre com notas mas não encerrado não entra na conta", () => {
  // 1º encerrado com 5; 2º em andamento com 10 (ignorado) → precisa de (24 − 5) ÷ 3
  const r = quantoFalta(bims([5, 10], 1), 6);
  assert.equal(r.situacao, "precisa");
  assert.ok(Math.abs((r.porBimestre ?? 0) - 19 / 3) < 1e-9);
  assert.equal(r.mediaAtual, 5);
});

test("quantoFalta: bimestre encerrado sem notas (media null) não conta, e o ano continua com 4", () => {
  const b = bims([6, null], 2);
  const r = quantoFalta(b, 6);
  assert.equal(r.situacao, "precisa");
  assert.equal(r.porBimestre, 6); // (24 − 6) ÷ 3
  assert.equal(r.mediaAtual, 6);
  assert.deepEqual(quantoFalta(bims([null, null], 2), 6), { situacao: "sem_dados" });
});

test("quantoFalta: média configurada 7", () => {
  const r = quantoFalta(bims([6, 6]), 7);
  assert.equal(r.situacao, "precisa");
  assert.equal(r.porBimestre, 8);
  assert.equal(quantoFalta(bims([7, 7, 7, 7]), 7).situacao, "atingiu");
  assert.equal(quantoFalta(bims([6, 7, 7, 7]), 7).situacao, "nao_atingiu");
});

test("quantoFalta: média configurada 0 → atingiu com qualquer nota encerrada", () => {
  assert.equal(quantoFalta(bims([0]), 0).situacao, "atingiu");
  assert.equal(quantoFalta(bims([0, 0, 0, 0]), 0).situacao, "atingiu");
});

test("quantoFalta: precisa de exatamente 10 → precisa; um pouco mais → impossível", () => {
  assert.equal(quantoFalta(bims([4, 4, 4]), 5.5).situacao, "precisa"); // 22 − 12 = 10
  assert.equal(quantoFalta(bims([4, 4, 3.9]), 5.5).situacao, "impossivel");
});

test("formatarNecessaria arredonda para cima (quem tira o número mostrado chega à média)", () => {
  assert.equal(formatarNecessaria(6.5), "6,5");
  assert.equal(formatarNecessaria(19 / 3), "6,4");
  assert.equal(formatarNecessaria(24 - 16.2), "7,8"); // 7.800000000000001
  assert.equal(formatarNecessaria(6.41), "6,5");
});

// acertoPorMateria
test("acertoPorMateria: anulada fora, não respondida conta como erro, poucas e ordem crescente", () => {
  const r = acertoPorMateria([
    ...Array.from({ length: 5 }, (_, i) => ({ materia: "matematica", correta: i < 4, anulada: false })),
    { materia: "matematica", correta: false, anulada: true },
    { materia: "fisica", correta: true, anulada: false },
    { materia: "fisica", correta: null, anulada: false },
    { materia: "fisica", correta: false, anulada: false },
    { materia: null, correta: true, anulada: false },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { materia: "fisica", rotulo: "Física", acertos: 1, total: 3, pct: (1 / 3) * 100, poucas: true });
  assert.deepEqual(r[1], { materia: "matematica", rotulo: "Matemática", acertos: 4, total: 5, pct: 80, poucas: false });
});

test("acertoPorMateria: matéria desconhecida usa o próprio código como rótulo; vazio → lista vazia", () => {
  assert.equal(acertoPorMateria([{ materia: "xadrez", correta: true, anulada: false }])[0].rotulo, "xadrez");
  assert.deepEqual(acertoPorMateria([]), []);
});

// situacaoNoSimulado
test("situacaoNoSimulado: os 5 casos", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  assert.equal(situacaoNoSimulado({ status: "entregue", prazo_em: null }, false, agora), "sem_login");
  assert.equal(situacaoNoSimulado(null, true, agora), "nao_fez");
  assert.equal(situacaoNoSimulado({ status: "entregue", prazo_em: "2026-10-22T11:00:00Z" }, true, agora), "fez");
  assert.equal(situacaoNoSimulado({ status: "em_andamento", prazo_em: "2026-10-22T13:00:00Z" }, true, agora), "fazendo");
  assert.equal(situacaoNoSimulado({ status: "em_andamento", prazo_em: "2026-10-22T11:00:00Z" }, true, agora), "nao_entregou");
  assert.equal(situacaoNoSimulado({ status: "em_andamento", prazo_em: null }, true, agora), "fazendo"); // treino sem cronômetro
});

// agruparAlunoEntreBimestres
test("agruparAlunoEntreBimestres: 'Joao' e 'João' juntam pelo nome normalizado", () => {
  const linhas = [
    { turmaId: "t1", bimestre: "1º", alunoId: "a1", nome: "Joao Silva" },
    { turmaId: "t1", bimestre: "1º", alunoId: "b1", nome: "Maria" },
    { turmaId: "t2", bimestre: "2º", alunoId: "a2", nome: "João  Silva" },
    { turmaId: "t2", bimestre: "2º", alunoId: "b2", nome: "Maria" },
  ];
  assert.deepEqual(agruparAlunoEntreBimestres(linhas, { alunoId: "a2", nome: "João  Silva" }, new Set()), { alunoIds: ["a1", "a2"], parcial: false });
});

test("agruparAlunoEntreBimestres: vínculo junta mesmo com o nome trocado", () => {
  const linhas = [
    { turmaId: "t1", bimestre: "1º", alunoId: "a1", nome: "Joaozinho" },
    { turmaId: "t2", bimestre: "2º", alunoId: "a2", nome: "João Silva" },
  ];
  assert.deepEqual(agruparAlunoEntreBimestres(linhas, { alunoId: "a2", nome: "João Silva" }, new Set(["a1", "a2"])), { alunoIds: ["a1", "a2"], parcial: false });
});

const pedros = [
  { turmaId: "t1", bimestre: "1º", alunoId: "p1a", nome: "Pedro Henrique" },
  { turmaId: "t1", bimestre: "1º", alunoId: "p1b", nome: "Pedro Henrique" },
  { turmaId: "t2", bimestre: "2º", alunoId: "p2a", nome: "Pedro Henrique" },
  { turmaId: "t2", bimestre: "2º", alunoId: "p2b", nome: "Pedro Henrique" },
];

test("agruparAlunoEntreBimestres: dois 'Pedro Henrique', um vinculado → só o vinculado, sem parcial", () => {
  assert.deepEqual(agruparAlunoEntreBimestres(pedros, { alunoId: "p2a", nome: "Pedro Henrique" }, new Set(["p1a", "p2a"])), { alunoIds: ["p1a", "p2a"], parcial: false });
});

test("agruparAlunoEntreBimestres: dois iguais sem vínculo → só o alvo, histórico parcial", () => {
  assert.deepEqual(agruparAlunoEntreBimestres(pedros, { alunoId: "p2a", nome: "Pedro Henrique" }, new Set()), { alunoIds: ["p2a"], parcial: true });
});

test("agruparAlunoEntreBimestres: nome repetido só na turma do alvo também não junta pelo nome", () => {
  const linhas = [
    { turmaId: "t1", bimestre: "1º", alunoId: "p1", nome: "Pedro Henrique" },
    { turmaId: "t2", bimestre: "2º", alunoId: "p2a", nome: "Pedro Henrique" },
    { turmaId: "t2", bimestre: "2º", alunoId: "p2b", nome: "Pedro Henrique" },
  ];
  assert.deepEqual(agruparAlunoEntreBimestres(linhas, { alunoId: "p2a", nome: "Pedro Henrique" }, new Set()), { alunoIds: ["p2a"], parcial: true });
});

// rankingTurma
test("rankingTurma: média dos encerrados, decrescente, empate em ordem alfabética, sem nota no fim", () => {
  const r = rankingTurma([
    { nome: "Carla", medias: [7, 9], encerrados: [true, false], vigente: 9 },
    { nome: "Bruno", medias: [8, 1], encerrados: [true, false], vigente: 1 },
    { nome: "Ana", medias: [7, 3], encerrados: [true, false], vigente: 3 },
    { nome: "Davi", medias: [null, 10], encerrados: [true, false], vigente: 10 },
  ]);
  assert.deepEqual(r.map((a) => a.nome), ["Bruno", "Ana", "Carla", "Davi"]);
  assert.equal(r[0].mediaRanking, 8);
  assert.equal(r[3].mediaRanking, null);
});

test("rankingTurma: nenhum encerrado → usa o bimestre vigente", () => {
  const r = rankingTurma([
    { nome: "Ana", medias: [5], encerrados: [false], vigente: 5 },
    { nome: "Bia", medias: [9], encerrados: [false], vigente: 9 },
  ]);
  assert.deepEqual(r.map((a) => a.nome), ["Bia", "Ana"]);
});

// distribuicao e aulas
test("distribuicaoMedias: 5 faixas, 10 na última, null fora", () => {
  assert.deepEqual(distribuicaoMedias([0, 1.99, 2, 5.5, 6, 8, 10, null]), [
    { faixa: "0–2", quantidade: 2 },
    { faixa: "2–4", quantidade: 1 },
    { faixa: "4–6", quantidade: 1 },
    { faixa: "6–8", quantidade: 1 },
    { faixa: "8–10", quantidade: 2 },
  ]);
});

test("resumoAulas conta concluídas, começadas e não começadas", () => {
  const r = resumoAulas([
    { titulo: "A", pct: 100, concluida: true },
    { titulo: "B", pct: 40, concluida: false },
    { titulo: "C", pct: 0, concluida: false },
  ]);
  assert.deepEqual([r.total, r.concluidas, r.comecadas, r.naoComecadas], [3, 1, 1, 1]);
});

// frases
function sim(titulo: string, situacao: LinhaSimuladoAluno["situacao"]): LinhaSimuladoAluno {
  return { simuladoId: titulo, titulo, abreEm: null, fechaEm: null, situacao, nota10: situacao === "fez" ? 7 : null, tempoSeg: null, saidas: null, tempoForaSeg: null };
}

function alunoBase(): Omit<RelatorioAluno, "frase"> {
  return { nome: "Ana", turmaNome: "3º A", anoLetivo: "2026", bimestres: [], quantoFalta: { situacao: "sem_dados" }, materias: [], simulados: [], treinos: [], aulas: null, ultimoAcesso: null, historicoParcial: false };
}

test("fraseAluno: sem simulados, sem cursos e sem notas → sem NaN, undefined nem '0 de 0'", () => {
  const f = fraseAluno(alunoBase(), 6);
  assert.ok(!/NaN|undefined|0 de 0/.test(f), f);
  assert.match(f, /Nenhum simulado para a turma ainda/);
  assert.match(f, /^Ana \(3º A\): /);
  const comAulasVazias = fraseAluno({ ...alunoBase(), aulas: resumoAulas([]) }, 6);
  assert.ok(!/NaN|undefined|0 de 0/.test(comAulasVazias), comAulasVazias);
});

test("fraseAluno: exemplo completo", () => {
  const b = bims([5, 5.4, 5.8, null], 3);
  const r: Omit<RelatorioAluno, "frase"> = {
    ...alunoBase(),
    nome: "João Silva",
    bimestres: b,
    quantoFalta: quantoFalta(b, 6),
    simulados: [sim("Ufms 23", "fez"), sim("Ufms 24", "nao_fez"), sim("Revisão 1", "fez"), sim("Revisão 2", "nao_entregou"), sim("Final", "fez")],
    materias: acertoPorMateria([
      ...Array.from({ length: 8 }, (_, i) => ({ materia: "fisica", correta: i < 3, anulada: false })),
      ...Array.from({ length: 5 }, () => ({ materia: "quimica", correta: true, anulada: false })),
    ]),
    aulas: resumoAulas(Array.from({ length: 12 }, (_, i) => ({ titulo: `Aula ${i}`, pct: i < 7 ? 100 : 0, concluida: i < 7 }))),
  };
  assert.equal(
    fraseAluno(r, 6),
    "João Silva (3º A): média 5,4 nos bimestres encerrados; precisa de 7,8 no 4º para chegar a 6,0. Fez 3 de 5 simulados (faltou ao 'Ufms 24' e ao 'Revisão 2'). Mais fraco em Física (38% de acerto). Assistiu 7 de 12 aulas.",
  );
});

test("fraseAluno: situações do quanto falta", () => {
  const com = (medias: (number | null)[], enc: number, media = 6) => {
    const b = bims(medias, enc);
    return fraseAluno({ ...alunoBase(), bimestres: b, quantoFalta: quantoFalta(b, media) }, media);
  };
  assert.match(com([5, 6], 2), /média 5,5 nos bimestres encerrados; precisa de 6,5 em cada um dos 2 bimestres restantes para chegar a 6,0\./);
  assert.match(com([9, 9, 9], 3), /média 9,0 nos bimestres encerrados; já atingiu a média 6,0\./);
  assert.match(com([2, 2, 2], 3), /não dá mais para chegar a 6,0 \(precisaria de 18,0 no bimestre restante\)/);
  assert.match(com([5, 5, 5, 5], 4), /média 5,0 nos 4 bimestres; ficou abaixo da média 6,0\./);
  assert.match(com([7.25], 0), /nenhum bimestre encerrado ainda \(7,3 no bimestre em andamento\)/);
  assert.match(com([], 0), /nenhum bimestre encerrado ainda\./);
});

test("fraseAluno: bimestre que falta é nomeado pelas linhas (2º encerrado sem notas → 'no 2º')", () => {
  const b: BimestreAluno[] = [
    { bimestre: "1º Bimestre", turmaId: "t1", media: 5, encerrado: true, vigente: false },
    { bimestre: "2º Bimestre", turmaId: "t2", media: null, encerrado: true, vigente: false },
    { bimestre: "3º Bimestre", turmaId: "t3", media: 6, encerrado: true, vigente: false },
    { bimestre: "4º Bimestre", turmaId: "t4", media: 6, encerrado: true, vigente: false },
  ];
  const q = quantoFalta(b, 6);
  assert.equal(q.situacao, "precisa");
  assert.equal(q.porBimestre, 7);
  const f = fraseAluno({ ...alunoBase(), bimestres: b, quantoFalta: q }, 6);
  assert.match(f, /precisa de 7,0 no 2º para chegar a 6,0\./);
  assert.doesNotMatch(f, /4º/);
  // Sem as 4 linhas não dá para saber qual é: texto neutro.
  const parcial = bims([6, 6, 6], 3);
  assert.match(fraseAluno({ ...alunoBase(), bimestres: parcial, quantoFalta: quantoFalta(parcial, 6) }, 6), /precisa de 6,0 no bimestre restante/);
});

test("fraseAluno: aluno sem conta e lista de faltas longa", () => {
  const semConta = fraseAluno({ ...alunoBase(), simulados: [sim("A", "sem_login"), sim("B", "sem_login")] }, 6);
  assert.match(semConta, /Sem conta de login: simulados e aulas não aparecem\./);
  const muitas = fraseAluno({ ...alunoBase(), simulados: ["A", "B", "C", "D", "E"].map((t) => sim(t, "nao_fez")) }, 6);
  assert.match(muitas, /Fez 0 de 5 simulados \(faltou ao 'A', ao 'B', ao 'C' e a mais 2\)\./);
  const todos = fraseAluno({ ...alunoBase(), simulados: [sim("A", "fez"), sim("B", "fazendo")] }, 6);
  assert.match(todos, /Fez 1 de 2 simulados \(1 em andamento\)\./);
});

function turmaBase(): Omit<RelatorioTurma, "frase"> {
  return { turmaNome: "3º A", anoLetivo: "2026", alunos: [], mediaPorBimestre: [], abaixoDaMedia: [], simulados: [], materiasFracas: [], distribuicao: distribuicaoMedias([]) };
}

test("fraseTurma: turma vazia → sem NaN nem '0 de 0'", () => {
  const f = fraseTurma(turmaBase(), 6);
  assert.ok(!/NaN|undefined|0 de 0/.test(f), f);
  assert.match(f, /Nenhum simulado para esta turma ainda/);
  assert.match(f, /nenhum aluno na planilha/);
});

test("fraseTurma: exemplo completo", () => {
  const qf = { situacao: "precisa" as const };
  const r: Omit<RelatorioTurma, "frase"> = {
    ...turmaBase(),
    alunos: ["Ana", "Bia", "Caio"].map((nome, i) => ({ alunoId: `a${i}`, nome, medias: [], quantoFalta: qf, temConta: true, simuladosFeitos: 1, simuladosTotal: 2, aulasConcluidas: null })),
    mediaPorBimestre: [
      { bimestre: "1º", turmaId: "t1", media: 6, encerrado: true, vigente: false },
      { bimestre: "2º", turmaId: "t2", media: 7, encerrado: true, vigente: false },
      { bimestre: "3º", turmaId: "t3", media: 2, encerrado: false, vigente: true },
    ],
    abaixoDaMedia: [{ alunoId: "a2", nome: "Caio", media: 4.5 }],
    simulados: [
      { simuladoId: "s1", titulo: "Ufms 23", abreEm: "2026-03-01T00:00:00Z", fechaEm: null, fizeram: 3, total: 3, naoFizeram: [] },
      { simuladoId: "s2", titulo: "Ufms 24", abreEm: "2026-05-01T00:00:00Z", fechaEm: null, fizeram: 2, total: 3, naoFizeram: ["Caio"] },
    ],
    materiasFracas: acertoPorMateria([
      ...Array.from({ length: 8 }, (_, i) => ({ materia: "fisica", correta: i < 3, anulada: false })),
      ...Array.from({ length: 5 }, (_, i) => ({ materia: "quimica", correta: i < 3, anulada: false })),
    ]),
  };
  assert.equal(
    fraseTurma(r, 6),
    "3º A (2026): 3 alunos, média 6,5 nos bimestres encerrados; 1 abaixo de 6,0. Último simulado ('Ufms 24'): 2 de 3 fizeram. Matérias mais fracas: Física (38%) e Química (60%).",
  );
});
