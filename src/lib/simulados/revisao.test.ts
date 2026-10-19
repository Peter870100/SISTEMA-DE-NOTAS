import { test } from "node:test";
import assert from "node:assert/strict";
import { assuntosParaRevisar, aulasDoTema, type InfoQuestao } from "./revisao";

const info = new Map<string, InfoQuestao>([
  ["q1", { materia: "biologia", assuntoId: "a-eco", assuntoNome: "Ecologia" }],
  ["q2", { materia: "biologia", assuntoId: "a-eco", assuntoNome: "Ecologia" }],
  ["q3", { materia: "biologia", assuntoId: "a-eco", assuntoNome: "Ecologia" }],
  ["q4", { materia: "quimica", assuntoId: "a-est", assuntoNome: "Estequiometria" }],
  ["q5", { materia: "historia", assuntoId: null, assuntoNome: null }],
  ["q6", { materia: "historia", assuntoId: null, assuntoNome: null }],
  ["q7", { materia: "fisica", assuntoId: "a-cin", assuntoNome: "Cinemática" }],
]);
const item = (questaoId: string, correta: boolean, anulada = false) => ({ questaoId, correta, anulada });

test("assuntosParaRevisar: agrupa erros por assunto, com mais erros primeiro", () => {
  const r = assuntosParaRevisar([item("q1", false), item("q2", false), item("q3", true), item("q4", false), item("q7", true)], info);
  assert.deepEqual(r.map((x) => [x.assuntoNome, x.erros, x.total]), [["Ecologia", 2, 3], ["Estequiometria", 1, 1]]);
});

test("assuntosParaRevisar: sem assunto, agrupa pela matéria", () => {
  const r = assuntosParaRevisar([item("q5", false), item("q6", false)], info);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].materia, r[0].assuntoId, r[0].assuntoNome, r[0].erros, r[0].total], ["historia", null, null, 2, 2]);
});

test("assuntosParaRevisar: ignora anuladas, assunto sem erro e questão sem classificação", () => {
  const r = assuntosParaRevisar([item("q1", false, true), item("q7", true), item("q-desconhecida", false)], info);
  assert.deepEqual(r, []);
});

test("assuntosParaRevisar: empate em erros vai para o pior aproveitamento e respeita o limite", () => {
  const r = assuntosParaRevisar([item("q1", false), item("q2", true), item("q4", false), item("q5", false)], info, 2);
  assert.deepEqual(r.map((x) => x.chave), ["a-est", "materia:historia"]);
});

test("aulasDoTema: acha aulas pelo nome do assunto, sem diferenciar acento e maiúscula", () => {
  const aulas = [
    { id: "1", titulo: "Aula 3 – ECOLOGIA e cadeias alimentares" },
    { id: "2", titulo: "Cinematica vetorial" },
    { id: "3", titulo: "Genética" },
  ];
  assert.deepEqual(aulasDoTema("Ecologia", aulas).map((a) => a.id), ["1"]);
  assert.deepEqual(aulasDoTema("Cinemática", aulas).map((a) => a.id), ["2"]);
  assert.deepEqual(aulasDoTema(null, aulas), []);
  assert.deepEqual(aulasDoTema("  ", aulas), []);
});

test("aulasDoTema: no máximo 2 aulas", () => {
  const aulas = [1, 2, 3].map((n) => ({ id: String(n), titulo: `Ecologia parte ${n}` }));
  assert.equal(aulasDoTema("Ecologia", aulas).length, 2);
});
