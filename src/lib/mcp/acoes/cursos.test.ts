import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherAula, escolherCurso, turmasDoCursoPedidas, type AulaLida, type CursoLido } from "./cursos-regras";
import { Pergunta } from "./ator";

const curso = (id: string, titulo: string, escolaNome = "Colégio Status"): CursoLido => ({ id, titulo, escolaId: "e", escolaNome });
const aula = (id: string, titulo: string, moduloTitulo = "Módulo 1"): AulaLida => ({ id, titulo, moduloTitulo, publicada: false });

test("escolherCurso: título exato escolhe, ignorando caixa e acento", () => {
  const r = escolherCurso([curso("1", "Álgebra Linear"), curso("2", "Álgebra")], { nome: "algebra" }, false);
  assert.ok("item" in r && r.item.id === "2");
});

test("escolherCurso: título parcial único só pergunta", () => {
  const r = escolherCurso([curso("1", "Redação ENEM"), curso("2", "Física")], { nome: "reda" }, false);
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /Achei só o curso Redação ENEM/);
  assert.match(r.mensagem, /Nada foi feito/);
});

test("escolherCurso: título repetido lista com ids e escola", () => {
  const r = escolherCurso([curso("a1", "Física", "Escola A"), curso("b2", "Física", "Escola B")], { nome: "Física" }, true);
  assert.ok("mensagem" in r);
  assert.match(r.mensagem, /Escola A; curso_id: a1/);
  assert.match(r.mensagem, /Escola B; curso_id: b2/);
});

test("escolherCurso: id vale, id desconhecido e nome inexistente são erro", () => {
  const lista = [curso("1", "Física")];
  assert.ok("item" in escolherCurso(lista, { id: "1" }, false));
  assert.throws(() => escolherCurso(lista, { id: "9" }, false), /Curso não encontrado/);
  assert.throws(() => escolherCurso(lista, { nome: "Química" }, false), /Curso "Química" não encontrado/);
  assert.throws(() => escolherCurso(lista, {}, false), /Informe o curso/);
});

test("escolherAula: exata escolhe; parcial pergunta; repetida lista módulo e aula_id", () => {
  const lista = [aula("1", "Funções", "Módulo 1"), aula("2", "Funções", "Módulo 2"), aula("3", "Limites")];
  const rep = escolherAula(lista, { nome: "funções" });
  assert.ok("mensagem" in rep);
  assert.match(rep.mensagem, /módulo Módulo 2; aula_id: 2/);
  const parcial = escolherAula(lista, { nome: "limit" });
  assert.ok("mensagem" in parcial);
  assert.match(parcial.mensagem, /Achei só a aula Limites/);
  const exata = escolherAula(lista, { nome: "Limites" });
  assert.ok("item" in exata && exata.item.id === "3");
  assert.throws(() => escolherAula(lista, { nome: "Derivadas" }), /Aula "Derivadas" não encontrada/);
});

const escola = [
  { nome: "1º Ano A", ano_letivo: "2025" },
  { nome: "1º Ano A", ano_letivo: "2026" },
  { nome: "2º Ano B", ano_letivo: "2026" },
];

test("turmasDoCursoPedidas: nome exato usa o ano mais recente e remove repetidas", () => {
  const r = turmasDoCursoPedidas([{ nome: "1º ano a" }, { nome: "1º Ano A" }, { nome: "2º Ano B" }], escola);
  assert.deepEqual(r, [{ turma_nome: "1º Ano A", ano_letivo: "2026" }, { turma_nome: "2º Ano B", ano_letivo: "2026" }]);
});

test("turmasDoCursoPedidas: ano informado vale; ano que não existe é erro com a lista", () => {
  assert.deepEqual(turmasDoCursoPedidas([{ nome: "1º Ano A", ano_letivo: "2025" }], escola), [{ turma_nome: "1º Ano A", ano_letivo: "2025" }]);
  assert.throws(() => turmasDoCursoPedidas([{ nome: "1º Ano A", ano_letivo: "2024" }], escola), /Turmas da escola: 1º Ano A · 2025, 1º Ano A · 2026, 2º Ano B · 2026/);
});

test("turmasDoCursoPedidas: nome inexistente lista as turmas da escola", () => {
  assert.throws(() => turmasDoCursoPedidas([{ nome: "3º Ano C" }], escola), /Turma não encontrada: "3º Ano C"\. Turmas da escola: 1º Ano A, 2º Ano B\./);
});

test("turmasDoCursoPedidas: nome só parecido vira pergunta", () => {
  assert.throws(() => turmasDoCursoPedidas([{ nome: "2º Ano" }], escola), Pergunta);
});

test("turmasDoCursoPedidas: lista vazia desvincula tudo", () => {
  assert.deepEqual(turmasDoCursoPedidas([], escola), []);
});

// ---------- modos: adicionar, remover, substituir ----------

import { turmasFinaisDoCurso } from "./cursos-regras";

const A25 = { turma_nome: "1º Ano A", ano_letivo: "2025" };
const A26 = { turma_nome: "1º Ano A", ano_letivo: "2026" };
const B26 = { turma_nome: "2º Ano B", ano_letivo: "2026" };

test("turmasFinaisDoCurso: adicionar junta às atuais sem duplicar e avisa o ano implícito", () => {
  const r = turmasFinaisDoCurso([A25], [{ nome: "2º Ano B" }, { nome: "1º Ano A", ano_letivo: "2025" }], escola, "adicionar");
  assert.deepEqual(r.final, [A25, B26]);
  assert.deepEqual(r.implicitas, [B26]);
});

test("turmasFinaisDoCurso: substituir troca a lista inteira", () => {
  assert.deepEqual(turmasFinaisDoCurso([A25, B26], [{ nome: "1º Ano A" }], escola, "substituir").final, [A26]);
});

test("turmasFinaisDoCurso: remover tira todos os anos do nome, ou só o ano dado", () => {
  assert.deepEqual(turmasFinaisDoCurso([A25, A26, B26], [{ nome: "1º ano a" }], escola, "remover").final, [B26]);
  assert.deepEqual(turmasFinaisDoCurso([A25, A26, B26], [{ nome: "1º Ano A", ano_letivo: "2025" }], escola, "remover").final, [A26, B26]);
});

test("turmasFinaisDoCurso: remover turma não ligada é erro com as atuais", () => {
  assert.throws(() => turmasFinaisDoCurso([B26], [{ nome: "1º Ano A" }], escola, "remover"), /não está ligado à turma "1º Ano A".*2º Ano B · 2026/);
});

test("turmasFinaisDoCurso: lista vazia é recusada sem desvincular_todas", () => {
  for (const modo of ["substituir", "adicionar", "remover"] as const) {
    assert.throws(() => turmasFinaisDoCurso([A26], [], escola, modo), /desvincular_todas: true/);
  }
  assert.deepEqual(turmasFinaisDoCurso([A26], [], escola, "substituir", true).final, []);
});

test("turmasFinaisDoCurso: remover que tiraria todas as turmas exige desvincular_todas", () => {
  assert.throws(() => turmasFinaisDoCurso([A25, A26], [{ nome: "1º Ano A" }], escola, "remover"), /desvincular_todas: true/);
  assert.deepEqual(turmasFinaisDoCurso([A25, A26], [{ nome: "1º Ano A" }], escola, "remover", true).final, []);
  assert.deepEqual(turmasFinaisDoCurso([A26, B26], [{ nome: "1º Ano A" }], escola, "remover").final, [B26]);
});
