import { test } from "node:test";
import assert from "node:assert/strict";
import { detalheDaUrl } from "./url";
import type { ConteudoDesempenho, MateriaDesempenho, PainelDesempenho } from "./tipos";

const cont = (chave: string, materia: string): ConteudoDesempenho => ({ chave, materia, materiaRotulo: materia, assuntoId: chave, nome: chave, questoes: 1, acertos: 0, erros: 1, emBranco: 0, taxaErro: 100, legenda: "" });
const mat = (materia: string, conteudos: ConteudoDesempenho[]): MateriaDesempenho => ({ materia, rotulo: materia, questoes: 1, acertos: 0, erros: 1, emBranco: 0, taxaAcerto: 0, conteudos });
const painel = { materias: [mat("matematica", [cont("a1", "matematica")]), mat("portugues", [cont("b1", "portugues")])] } as unknown as PainelDesempenho;

test("matéria e conteúdo válidos", () => {
  assert.deepEqual(detalheDaUrl(painel, { materia: "matematica", conteudo: "a1" }), { materia: "matematica", conteudo: "a1" });
});
test("conteúdo de outra matéria vira null", () => {
  assert.deepEqual(detalheDaUrl(painel, { materia: "matematica", conteudo: "b1" }), { materia: "matematica", conteudo: null });
});
test("desconhecidos viram null", () => {
  assert.deepEqual(detalheDaUrl(painel, { materia: "x", conteudo: "y" }), { materia: null, conteudo: null });
  assert.deepEqual(detalheDaUrl(painel, { materia: "portugues", conteudo: "y" }), { materia: "portugues", conteudo: null });
});
test("array usa o primeiro", () => {
  assert.deepEqual(detalheDaUrl(painel, { materia: ["portugues", "matematica"], conteudo: ["b1", "a1"] }), { materia: "portugues", conteudo: "b1" });
});
test("só conteúdo válido preenche a matéria", () => {
  assert.deepEqual(detalheDaUrl(painel, { conteudo: "b1" }), { materia: "portugues", conteudo: "b1" });
});
test("sem parâmetros", () => {
  assert.deepEqual(detalheDaUrl(painel, {}), { materia: null, conteudo: null });
});
