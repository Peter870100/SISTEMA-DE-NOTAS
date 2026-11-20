import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorMateria, textoQuantidadeConteudos } from "./grupos";

test("agrupa os conteúdos do plano por matéria, na ordem do plano", () => {
  const lista = [
    { chave: "a", materiaRotulo: "História" },
    { chave: "b", materiaRotulo: "Química" },
    { chave: "c", materiaRotulo: "História" },
    { chave: "d", materiaRotulo: " " },
    { chave: "e", materiaRotulo: "Química" },
  ];
  assert.deepEqual(agruparPorMateria(lista).map((g) => [g.materia, g.itens.map((c) => c.chave)]), [
    ["História", ["a", "c"]],
    ["Química", ["b", "e"]],
    ["Outros", ["d"]],
  ]);
  assert.deepEqual(agruparPorMateria([]), []);
});

test("texto da quantidade de conteúdos", () => {
  assert.equal(textoQuantidadeConteudos(1), "1 conteúdo");
  assert.equal(textoQuantidadeConteudos(4), "4 conteúdos");
});
