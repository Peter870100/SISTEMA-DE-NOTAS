import { test } from "node:test";
import assert from "node:assert/strict";
import { descreverOrigem, descreverResumo, mensagemRestauracao } from "./lixeira";

test("descreverResumo de planilha lista alunos, atividades e notas com plural certo", () => {
  assert.equal(descreverResumo("turma", { alunos: 32, atividades: 8, notas: 254 }), "32 alunos · 8 atividades · 254 notas");
  assert.equal(descreverResumo("turma", { alunos: 1, atividades: 1, notas: 1 }), "1 aluno · 1 atividade · 1 nota");
  assert.equal(descreverResumo("turma", { alunos: 0, atividades: 0, notas: 0 }), "planilha vazia");
});

test("descreverResumo de aluno/atividade mostra só as notas", () => {
  assert.equal(descreverResumo("aluno", { notas: 12 }), "12 notas");
  assert.equal(descreverResumo("atividade", { notas: 1 }), "1 nota");
  assert.equal(descreverResumo("aluno", {}), "sem notas");
});

test("descreverOrigem cobre Hermes, professor e autor removido", () => {
  assert.equal(descreverOrigem("hermes", "Ana Lima", true), "Hermes, a pedido de Ana Lima");
  assert.equal(descreverOrigem("hermes", null, false), "Hermes");
  assert.equal(descreverOrigem("app", "Ana Lima", true), "Ana Lima");
  assert.equal(descreverOrigem("app", null, true), "Professor removido");
  assert.equal(descreverOrigem("app", null, false), "Desconhecido");
});

test("mensagemRestauracao informa notas restauradas e puladas", () => {
  assert.equal(
    mensagemRestauracao({ tipo: "turma", turma_id: "t", notas_restauradas: 254, notas_puladas: 0 }),
    "Planilha restaurada com 254 notas."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "aluno", turma_id: "t", notas_restauradas: 9, notas_puladas: 3 }),
    "Aluno restaurado com 9 notas. 3 notas foram puladas porque a atividade ou o aluno delas não existe mais."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "atividade", turma_id: "t", notas_restauradas: 1, notas_puladas: 1 }),
    "Atividade restaurada com 1 nota. 1 nota foi pulada porque a atividade ou o aluno dela não existe mais."
  );
  assert.equal(
    mensagemRestauracao({ tipo: "aluno", turma_id: "t", notas_restauradas: 0, notas_puladas: 0 }),
    "Aluno restaurado."
  );
});
