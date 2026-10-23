import { test } from "node:test";
import assert from "node:assert/strict";
import { alunosSemConta, escolherLinhasParaCriar, limparNome, linhaDeReferencia, nomesDeContasSemLigacao, pessoasDaReferencia, sugerirLigacoes } from "./ligacao";

test("sugerirLigacoes: acento, espaço e maiúsculas casam (João Silva × joao  silva)", () => {
  const r = sugerirLigacoes([{ contaId: "c1", nome: "João Silva", alunoIdAtual: null }], [{ alunoId: "a1", nome: "joao  silva", jaLigado: false }]);
  assert.deepEqual(r.ligar, [{ contaId: "c1", alunoId: "a1" }]);
  assert.deepEqual(r.repetidos, []);
  assert.deepEqual(r.semPar, []);
});

test("sugerirLigacoes: dois alunos Pedro → nenhum ligado e aparece em repetidos", () => {
  const r = sugerirLigacoes(
    [{ contaId: "c1", nome: "Pedro", alunoIdAtual: null }],
    [
      { alunoId: "a1", nome: "Pedro", jaLigado: false },
      { alunoId: "a2", nome: "pedro ", jaLigado: false },
    ],
  );
  assert.deepEqual(r.ligar, []);
  assert.deepEqual(r.repetidos, [{ nome: "Pedro", contas: 1, alunos: 2 }]);
  assert.deepEqual(r.semPar, []);
});

test("sugerirLigacoes: duas contas com o mesmo nome e um aluno → nenhum ligado", () => {
  const r = sugerirLigacoes(
    [
      { contaId: "c1", nome: "Ana Lima", alunoIdAtual: null },
      { contaId: "c2", nome: "ana lima", alunoIdAtual: null },
    ],
    [{ alunoId: "a1", nome: "Ana Lima", jaLigado: false }],
  );
  assert.deepEqual(r.ligar, []);
  assert.deepEqual(r.repetidos, [{ nome: "Ana Lima", contas: 2, alunos: 1 }]);
});

test("sugerirLigacoes: conta já ligada é ignorada", () => {
  const r = sugerirLigacoes([{ contaId: "c1", nome: "Maria", alunoIdAtual: "a9" }], [{ alunoId: "a1", nome: "Maria", jaLigado: false }]);
  assert.deepEqual(r.ligar, []);
  assert.deepEqual(r.semPar, []);
});

test("sugerirLigacoes: aluno já ligado é ignorado (a conta fica sem par)", () => {
  const r = sugerirLigacoes([{ contaId: "c1", nome: "Maria", alunoIdAtual: null }], [{ alunoId: "a1", nome: "Maria", jaLigado: true }]);
  assert.deepEqual(r.ligar, []);
  assert.deepEqual(r.semPar, ["Maria"]);
});

test("sugerirLigacoes: conta já ligada não conta como repetida para outra conta de mesmo nome", () => {
  const r = sugerirLigacoes(
    [
      { contaId: "c1", nome: "Lia", alunoIdAtual: "a9" },
      { contaId: "c2", nome: "Lia", alunoIdAtual: null },
    ],
    [{ alunoId: "a1", nome: "Lia", jaLigado: false }],
  );
  assert.deepEqual(r.ligar, [{ contaId: "c2", alunoId: "a1" }]);
});

test("linhaDeReferencia: o bimestre vigente", () => {
  assert.equal(
    linhaDeReferencia([
      { turmaId: "t1", vigente: false, bimestre: "1º Bimestre" },
      { turmaId: "t2", vigente: true, bimestre: "2º Bimestre" },
      { turmaId: "t3", vigente: false, bimestre: "3º Bimestre" },
    ]),
    "t2",
  );
});

test("linhaDeReferencia: sem vigente → o último pela ordem do bimestre", () => {
  assert.equal(
    linhaDeReferencia([
      { turmaId: "t3", vigente: false, bimestre: "3º Bimestre" },
      { turmaId: "t1", vigente: false, bimestre: "1º Bimestre" },
      { turmaId: "t2", vigente: false, bimestre: "2º Bimestre" },
    ]),
    "t3",
  );
  assert.equal(linhaDeReferencia([]), null);
});

test("alunosSemConta: tira os já ligados", () => {
  const alunos = [
    { alunoId: "a1", nome: "A" },
    { alunoId: "a2", nome: "B" },
  ];
  assert.deepEqual(alunosSemConta(alunos, new Set(["a1"])), [{ alunoId: "a2", nome: "B" }]);
});

test("escolherLinhasParaCriar: rodar duas vezes não cria de novo para quem já tem conta ligada", () => {
  const alunos = [
    { alunoId: "a1", nome: "Ana  Lima" },
    { alunoId: "a2", nome: "Bruno" },
  ];
  const pedidas = [
    { alunoId: "a1", usuario: "ana.lima" },
    { alunoId: "a2", usuario: "bruno" },
  ];
  const primeira = escolherLinhasParaCriar(pedidas, alunos, new Set());
  assert.deepEqual(primeira.criar, [
    { alunoId: "a1", nome: "Ana Lima", usuario: "ana.lima" },
    { alunoId: "a2", nome: "Bruno", usuario: "bruno" },
  ]);
  const segunda = escolherLinhasParaCriar(pedidas, alunos, new Set(["a1", "a2"]));
  assert.deepEqual(segunda.criar, []);
  assert.deepEqual(segunda.ignorados, ["Ana Lima", "Bruno"]);
});

test("limparNome: tira espaços das pontas e repetidos, sem mexer nas letras", () => {
  assert.equal(limparNome("  Ana   Souza "), "Ana Souza");
  assert.equal(limparNome("Vanessa"), "Vanessa");
  assert.equal(limparNome("Sassá\tSilva"), "Sassá Silva");
});

test("pessoasDaReferencia: conta ligada à linha do 1º bimestre conta como ligada quando o 2º é o vigente", () => {
  const linhas = [
    { turmaId: "b1", alunoId: "a1-1", nome: "Ana Lima" },
    { turmaId: "b1", alunoId: "b1-1", nome: "Bruno" },
    { turmaId: "b2", alunoId: "a1-2", nome: "ana  lima" },
    { turmaId: "b2", alunoId: "b1-2", nome: "Bruno" },
  ];
  const pessoas = pessoasDaReferencia(linhas, "b2", new Map([["a1-1", "conta-ana"]]));
  assert.deepEqual(pessoas, [
    { alunoId: "a1-2", nome: "ana  lima", contas: ["conta-ana"] },
    { alunoId: "b1-2", nome: "Bruno", contas: [] },
  ]);
  // Sem duplicar: a prévia de criação e a de ligação só oferecem o Bruno.
  const ligados = new Set(pessoas.filter((p) => p.contas.length > 0).map((p) => p.alunoId));
  assert.deepEqual(alunosSemConta(pessoas, ligados).map((p) => p.alunoId), ["b1-2"]);
  const criar = escolherLinhasParaCriar([{ alunoId: "a1-2", usuario: "ana.lima" }], pessoas, ligados);
  assert.deepEqual(criar.criar, []);
  assert.deepEqual(criar.ignorados, ["ana lima"]);
  const sugestao = sugerirLigacoes(
    [{ contaId: "conta-ana2", nome: "Ana Lima", alunoIdAtual: null }],
    pessoas.map((p) => ({ alunoId: p.alunoId, nome: p.nome, jaLigado: p.contas.length > 0 })),
  );
  assert.deepEqual(sugestao.ligar, []);
});

test("pessoasDaReferencia: nome repetido numa turma não junta entre bimestres", () => {
  const linhas = [
    { turmaId: "b1", alunoId: "p1", nome: "Pedro" },
    { turmaId: "b1", alunoId: "p2", nome: "Pedro" },
    { turmaId: "b2", alunoId: "p3", nome: "Pedro" },
  ];
  assert.deepEqual(pessoasDaReferencia(linhas, "b2", new Map([["p1", "c1"]])), [{ alunoId: "p3", nome: "Pedro", contas: [] }]);
  const linhasRef = [
    { turmaId: "b1", alunoId: "p1", nome: "Pedro" },
    { turmaId: "b2", alunoId: "p3", nome: "Pedro" },
    { turmaId: "b2", alunoId: "p4", nome: "Pedro" },
  ];
  assert.deepEqual(
    pessoasDaReferencia(linhasRef, "b2", new Map([["p1", "c1"]])).map((p) => p.contas),
    [[], []],
  );
});

test("nomesDeContasSemLigacao: só as contas sem ligação, normalizadas", () => {
  assert.deepEqual(
    [...nomesDeContasSemLigacao([
      { nome: "João Silva", alunoIdAtual: null },
      { nome: "Maria", alunoIdAtual: "a1" },
    ])],
    ["joao silva"],
  );
});

test("escolherLinhasParaCriar: nome vem da planilha, id repetido conta uma vez e id de fora é desconhecido", () => {
  const r = escolherLinhasParaCriar(
    [
      { alunoId: "a1", usuario: "x" },
      { alunoId: "a1", usuario: "y" },
      { alunoId: "zz", usuario: "z" },
    ],
    [{ alunoId: "a1", nome: "Carla" }],
    new Set(),
  );
  assert.deepEqual(r.criar, [{ alunoId: "a1", nome: "Carla", usuario: "x" }]);
  assert.deepEqual(r.desconhecidos, ["zz"]);
});
