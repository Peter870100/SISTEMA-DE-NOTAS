import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveValida, materiaisDoConteudo, minutosDaAula, semNenhumMaterial } from "./extras";
import type { MaterialRevisao } from "../types";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

test("chaveValida", () => {
  assert.deepEqual(chaveValida("materia:matematica"), { materia: "matematica" });
  assert.equal(chaveValida("materia:xyz"), null);
  assert.equal(chaveValida("abc"), null);
  assert.equal(chaveValida(""), null);
  assert.equal(chaveValida(UUID.toUpperCase()), null);
  assert.deepEqual(chaveValida(UUID), { assuntoId: UUID });
});

test("minutosDaAula", () => {
  assert.equal(minutosDaAula(601, 15), 15);
  assert.equal(minutosDaAula(1260, 15), 25);
  assert.equal(minutosDaAula(30, 15), 5);
  assert.equal(minutosDaAula(undefined, 15), 15);
});

const lin = (o: Partial<MaterialRevisao> & { id: string }): MaterialRevisao => ({
  escola_id: null, topico_id: null, assunto_id: null, aula_id: null, titulo: null, url: null, created_at: "2026-01-01", ...o,
});
const base = {
  topicoFocoId: "t1", assuntoId: "a1", escolaId: "e1", aulas: { x: { titulo: "Aula X", acessivel: true }, y: { titulo: "Aula Y", acessivel: false }, z: { titulo: "Aula Z", acessivel: true } },
  aulasDoTema: [], duracoesSeg: {}, visao: "aluno" as const, minutosMaterial: 15,
};

test("materiaisDoConteudo: outra escola fica de fora e topico vem antes do assunto", () => {
  const r = materiaisDoConteudo({ ...base, linhas: [
    lin({ id: "1", assunto_id: "a1", titulo: "Link A", url: "https://a.com" }),
    lin({ id: "2", topico_id: "t1", titulo: "Link T", url: "https://t.com" }),
    lin({ id: "3", topico_id: "t1", escola_id: "outra", titulo: "Fora", url: "https://f.com" }),
  ] });
  assert.deepEqual(r.map((m) => m.titulo), ["Link T", "Link A"]);
  assert.equal(r[0].href, "https://t.com");
  assert.equal(materiaisDoConteudo({ ...base, visao: "escola", linhas: [lin({ id: "2", topico_id: "t1", titulo: "Link T", url: "https://t.com" })] })[0].href, "https://t.com");
  assert.equal(r[0].minutos, 15);
  assert.equal(r[0].tipo, "link");
});

test("materiaisDoConteudo: aula sem acesso some no aluno e aparece sem href na escola", () => {
  const linhas = [lin({ id: "1", topico_id: "t1", aula_id: "y" }), lin({ id: "2", topico_id: "t1", aula_id: "x" })];
  const a = materiaisDoConteudo({ ...base, linhas });
  assert.deepEqual(a.map((m) => m.id), ["x"]);
  assert.equal(a[0].href, "/aluno/aulas/x");
  const e = materiaisDoConteudo({ ...base, linhas, visao: "escola" });
  assert.deepEqual(e.map((m) => m.id), ["y", "x"]);
  assert.equal(e[0].href, null);
});

test("materiaisDoConteudo: aula repetida aparece uma vez e usa duracao", () => {
  const r = materiaisDoConteudo({ ...base, linhas: [lin({ id: "1", assunto_id: "a1", aula_id: "x" })],
    aulasDoTema: [{ id: "x", titulo: "Aula X" }, { id: "z", titulo: "Aula Z" }], duracoesSeg: { x: 1260 } });
  assert.deepEqual(r.map((m) => m.id), ["x", "z"]);
  assert.equal(r[0].minutos, 25);
  assert.equal(r[1].minutos, 15);
});

test("semNenhumMaterial: só quando não há material nem estudo", () => {
  const mat = { id: "m", titulo: "t", tipo: "link" as const, href: "x", minutos: 5 };
  assert.equal(semNenhumMaterial({ materiais: [], estudo: null }), true);
  assert.equal(semNenhumMaterial({ materiais: [mat], estudo: null }), false);
  assert.equal(semNenhumMaterial({ materiais: [], estudo: { assuntoId: UUID, minutos: 20 } }), false);
});
