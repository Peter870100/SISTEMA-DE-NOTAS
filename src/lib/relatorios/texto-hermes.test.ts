import { test } from "node:test";
import assert from "node:assert/strict";
import type { Escopo } from "@/lib/mcp/escopo";
import { linhaDoLink, pessoasAchadas, textoRelatorioAluno, textoRelatorioTurma, turmaDoLink, turmasVisiveis } from "./texto-hermes";
import type { LinhaSimuladoAluno, RelatorioAluno, RelatorioTurma } from "./tipos";

const LINK = "https://www.statusavalia.com.br/turma/t4/relatorio/aluno/a4";

const sim = (titulo: string, situacao: LinhaSimuladoAluno["situacao"], nota10: number | null = null, saidas: number | null = null): LinhaSimuladoAluno => ({
  simuladoId: titulo, titulo, abreEm: "2026-05-01T12:00:00Z", fechaEm: null, situacao, nota10, tempoSeg: null, saidas, tempoForaSeg: null,
});

function aluno(extra: Partial<RelatorioAluno> = {}): RelatorioAluno {
  return {
    nome: "João Silva",
    turmaNome: "3º A",
    anoLetivo: "2026",
    bimestres: [
      { bimestre: "1º Bimestre", turmaId: "t1", media: 5, encerrado: true, vigente: false },
      { bimestre: "2º Bimestre", turmaId: "t2", media: 6, encerrado: true, vigente: false },
      { bimestre: "3º Bimestre", turmaId: "t3", media: 7.25, encerrado: false, vigente: true },
      { bimestre: "4º Bimestre", turmaId: "t4", media: null, encerrado: false, vigente: false },
    ],
    quantoFalta: { situacao: "precisa", porBimestre: 6.5, mediaAtual: 5.5 },
    materias: [
      { materia: "fisica", rotulo: "Física", acertos: 5, total: 13, pct: 38.46, poucas: false },
      { materia: "quimica", rotulo: "Química", acertos: 2, total: 3, pct: 66.7, poucas: true },
    ],
    simulados: [sim("Ufms 24", "fez", 7.5, 2), sim("Revisão 2", "nao_fez"), sim("Revisão 3", "fazendo", null, 1)],
    treinos: [sim("Treino 1", "fez", 8), sim("Treino 2", "fazendo")],
    aulas: { total: 12, concluidas: 7, comecadas: 2, naoComecadas: 3, aulas: [] },
    ultimoAcesso: "2026-10-20T13:30:00Z",
    historicoParcial: false,
    frase: "João Silva (3º A): média 5,5 nos bimestres encerrados; precisa de 6,5 em cada um dos 2 bimestres restantes para chegar a 6,0. Fez 1 de 3 simulados.",
    ...extra,
  };
}

function turma(extra: Partial<RelatorioTurma> = {}): RelatorioTurma {
  return {
    turmaNome: "3º A",
    anoLetivo: "2026",
    alunos: [
      { alunoId: "a1", nome: "Ana", medias: [8, 7], quantoFalta: { situacao: "atingiu", mediaAtual: 8 }, temConta: true, simuladosFeitos: 2, simuladosTotal: 2, aulasConcluidas: 3 },
      { alunoId: "a2", nome: "Bruno", medias: [4, 5], quantoFalta: { situacao: "precisa", porBimestre: 7, mediaAtual: 4 }, temConta: false, simuladosFeitos: 0, simuladosTotal: 2, aulasConcluidas: null },
    ],
    mediaPorBimestre: [
      { bimestre: "1º Bimestre", turmaId: "t1", media: 6, encerrado: true, vigente: false },
      { bimestre: "2º Bimestre", turmaId: "t2", media: 6.1, encerrado: false, vigente: true },
    ],
    abaixoDaMedia: [{ alunoId: "a2", nome: "Bruno", media: 4 }],
    simulados: [
      { simuladoId: "s1", titulo: "Ufms 24", abreEm: "2026-04-01T12:00:00Z", fechaEm: null, fizeram: 2, total: 2, naoFizeram: [] },
      { simuladoId: "s2", titulo: "Revisão 2", abreEm: "2026-06-01T12:00:00Z", fechaEm: null, fizeram: 1, total: 2, naoFizeram: ["Bruno"] },
    ],
    materiasFracas: [{ materia: "fisica", rotulo: "Física", acertos: 5, total: 13, pct: 38.46, poucas: false }],
    distribuicao: [],
    frase: "3º A (2026): 2 alunos, média 6,0 nos bimestres encerrados; 1 abaixo de 6,0. Último simulado ('Revisão 2'): 1 de 2 fizeram.",
    ...extra,
  };
}

const linhas = (s: string) => s.split("\n");
const semLixo = (s: string) => {
  assert.doesNotMatch(s, /NaN|undefined|null|Infinity/);
};

// ---------- aluno ----------

test("textoRelatorioAluno: frase, detalhes e link, no maximo 10 linhas", () => {
  const t = textoRelatorioAluno(aluno(), LINK);
  const ls = linhas(t);
  assert.equal(ls[0], aluno().frase);
  assert.ok(ls.length <= 10, `linhas: ${ls.length}`);
  assert.ok(ls.length >= 7, "frase + 5 a 8 linhas de detalhe + link");
  assert.equal(ls.at(-1), `Relatório completo (abra logado): ${LINK}`);
  assert.match(t, /7,3/); // média do bimestre em andamento com uma casa
  assert.match(t, /em andamento/);
  assert.match(t, /Ufms 24.*7,5/);
  assert.match(t, /Revisão 2.*não fez/);
  assert.match(t, /Física 38%/);
  assert.match(t, /7 de 12/);
  semLixo(t);
});

test("textoRelatorioAluno: sem simulados diz isso", () => {
  const t = textoRelatorioAluno(aluno({ simulados: [], treinos: [], materias: [] }), LINK);
  assert.match(t, /[Nn]enhum simulado/);
  assert.ok(linhas(t).length <= 10);
  semLixo(t);
});

test("textoRelatorioAluno: aluno sem conta, sem notas e sem nada nao mostra NaN/undefined", () => {
  const r = aluno({
    bimestres: [{ bimestre: "1º Bimestre", turmaId: "t1", media: null, encerrado: false, vigente: true }],
    quantoFalta: { situacao: "sem_dados" },
    materias: [],
    simulados: [sim("Ufms 24", "sem_login")],
    treinos: [],
    aulas: null,
    ultimoAcesso: null,
    historicoParcial: true,
  });
  const t = textoRelatorioAluno(r, LINK);
  assert.match(t, /sem conta de login/i);
  assert.match(t, /[Hh]istórico parcial/);
  assert.ok(linhas(t).length <= 10);
  assert.ok(t.endsWith(LINK));
  semLixo(t);
});

test("textoRelatorioAluno: muitos simulados ficam cortados", () => {
  const muitos = Array.from({ length: 15 }, (_, i) => sim(`Prova ${i + 1}`, i % 2 ? "fez" : "nao_entregou", 6));
  const t = textoRelatorioAluno(aluno({ simulados: muitos }), LINK);
  assert.match(t, /e mais \d+/);
  assert.ok(linhas(t).length <= 10);
  semLixo(t);
});

// ---------- turma ----------

test("textoRelatorioTurma: frase, detalhes e link, no maximo 10 linhas", () => {
  const t = textoRelatorioTurma(turma(), LINK);
  const ls = linhas(t);
  assert.equal(ls[0], turma().frase);
  assert.ok(ls.length <= 10, `linhas: ${ls.length}`);
  assert.ok(ls.length >= 7);
  assert.equal(ls.at(-1), `Relatório completo (abra logado): ${LINK}`);
  assert.match(t, /Bruno 4,0/);
  assert.match(t, /Revisão 2.*1 de 2/);
  assert.match(t, /Física 38%/);
  assert.match(t, /1 de 2 alunos/); // contas de login
  semLixo(t);
});

test("textoRelatorioTurma: sem simulados diz isso", () => {
  const t = textoRelatorioTurma(turma({ simulados: [], materiasFracas: [] }), LINK);
  assert.match(t, /[Nn]enhum simulado/);
  assert.ok(linhas(t).length <= 10);
  semLixo(t);
});

test("textoRelatorioTurma: turma vazia nao quebra", () => {
  const t = textoRelatorioTurma(turma({
    alunos: [], abaixoDaMedia: [], simulados: [], materiasFracas: [],
    mediaPorBimestre: [{ bimestre: "1º Bimestre", turmaId: "t1", media: null, encerrado: false, vigente: true }],
    frase: "3º A (2026): nenhum aluno na planilha ainda. Nenhum simulado para esta turma ainda.",
  }), LINK);
  assert.ok(linhas(t).length <= 10);
  assert.ok(t.endsWith(LINK));
  semLixo(t);
});

// ---------- qual turma vai no link ----------

const bims = [
  { id: "t2", bimestre: "2º Bimestre", bimestre_vigente: false },
  { id: "t1", bimestre: "1º Bimestre", bimestre_vigente: false },
  { id: "t3", bimestre: "3º Bimestre", bimestre_vigente: true },
];

test("turmaDoLink: o bimestre vigente; sem vigente, o ultimo", () => {
  assert.equal(turmaDoLink(bims)?.id, "t3");
  assert.equal(turmaDoLink(bims.map((b) => ({ ...b, bimestre_vigente: false })))?.id, "t3");
  assert.equal(turmaDoLink(bims.slice(0, 2))?.id, "t2");
  assert.equal(turmaDoLink([]), null);
});

test("linhaDoLink: a linha do aluno no bimestre vigente", () => {
  const l = linhaDoLink(bims, [{ turmaId: "t1", alunoId: "a1" }, { turmaId: "t3", alunoId: "a3" }, { turmaId: "t2", alunoId: "a2" }]);
  assert.deepEqual(l, { turmaId: "t3", alunoId: "a3" });
});

test("linhaDoLink: sem linha no vigente, o ultimo bimestre em que o aluno esta", () => {
  const l = linhaDoLink(bims, [{ turmaId: "t1", alunoId: "a1" }, { turmaId: "t2", alunoId: "a2" }]);
  assert.deepEqual(l, { turmaId: "t2", alunoId: "a2" });
  assert.equal(linhaDoLink(bims, []), null);
});

// ---------- alcance e pessoas achadas ----------

const prof = (turmas: Set<string> | null, escolaId = "e1"): Escopo => ({ tipo: "professor", escolaId, professorId: "p1", turmas });
const turmasTodas = [
  { id: "t1", escola_id: "e1", nome: "3º A" },
  { id: "t2", escola_id: "e1", nome: "3º B" },
  { id: "t3", escola_id: "e2", nome: "3º A" },
];

test("turmasVisiveis: professor restrito so ve as liberadas da escola dele (Review Focus 1)", () => {
  assert.deepEqual(turmasVisiveis(prof(new Set(["3º B"])), turmasTodas).map((t) => t.id), ["t2"]);
  assert.deepEqual(turmasVisiveis(prof(new Set()), turmasTodas), []);
  assert.deepEqual(turmasVisiveis(prof(null), turmasTodas).map((t) => t.id), ["t1", "t2"]);
  assert.deepEqual(turmasVisiveis({ tipo: "dono" }, turmasTodas).map((t) => t.id), ["t1", "t2", "t3"]);
});

const L = (grupo: string, turmaId: string, bimestre: string, alunoId: string, nome: string) => ({ grupo, turmaId, bimestre, alunoId, nome });

test("pessoasAchadas: o mesmo aluno em varios bimestres vira uma pessoa so", () => {
  const todas = [L("g", "t1", "1º", "a1", "João Silva"), L("g", "t2", "2º", "b1", "Joao Silva"), L("g", "t2", "2º", "b2", "Maria")];
  const ps = pessoasAchadas(todas, [todas[0], todas[1]], () => new Set());
  assert.equal(ps.length, 1);
  assert.deepEqual([...ps[0].alunoIds].sort(), ["a1", "b1"]);
});

test("pessoasAchadas: dois com o mesmo nome na turma continuam separados", () => {
  const todas = [L("g", "t1", "1º", "a1", "Pedro Henrique"), L("g", "t1", "1º", "a2", "Pedro Henrique")];
  assert.equal(pessoasAchadas(todas, todas, () => new Set()).length, 2);
});

test("pessoasAchadas: nome mudado entre bimestres junta pelo vinculo da conta", () => {
  const todas = [L("g", "t1", "1º", "a1", "Joãozinho"), L("g", "t2", "2º", "b1", "João Pedro")];
  const ps = pessoasAchadas(todas, [todas[1]], (id) => (id === "b1" || id === "a1" ? new Set(["a1", "b1"]) : new Set()));
  assert.equal(ps.length, 1);
  assert.deepEqual([...ps[0].alunoIds].sort(), ["a1", "b1"]);
});

test("pessoasAchadas: mesmo nome em turmas diferentes sao pessoas diferentes", () => {
  const todas = [L("g1", "t1", "1º", "a1", "Ana"), L("g2", "t9", "1º", "z1", "Ana")];
  assert.equal(pessoasAchadas(todas, todas, () => new Set()).length, 2);
});
