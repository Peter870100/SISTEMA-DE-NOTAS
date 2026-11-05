import test from "node:test";
import assert from "node:assert/strict";
import type { Letra, SituacaoEstudo } from "../types";
import { aplicarChecagem, podeRegravar, podeCorrigirExercicio, visivelAoAluno, ehAmostra, exercicioMudou, imagemDisponivel, podeGerir } from "./situacao";

const ex = (ordem: number, o: Partial<{ resposta_correta: Letra; situacao: SituacaoEstudo; checagens: number }> = {}) =>
  ({ ordem, resposta_correta: "A" as Letra, situacao: "rascunho" as SituacaoEstudo, checagens: 0, ...o });
const dez = Array.from({ length: 10 }, (_, i) => ex(i + 1));
const parecer = (o = {}) => ({ verificador: "subagente 1", texto: { ok: true },
  exercicios: dez.map((e) => ({ ordem: e.ordem, ok: true, resposta_encontrada: "A" as Letra })), ...o });
const m0 = { situacao: "rascunho" as SituacaoEstudo, checagens: 0 };

test("tudo certo publica", () => {
  const r = aplicarChecagem(m0, dez, parecer());
  assert.ok(r.ok);
  assert.equal(r.material.situacao, "publicado");
  assert.ok(r.exercicios.every((e) => e.situacao === "publicado" && e.checagens === 1));
});
test("resposta diferente do gabarito retém mesmo com ok", () => {
  const p = parecer({ exercicios: dez.map((e) => ({ ordem: e.ordem, ok: true, resposta_encontrada: (e.ordem === 3 ? "B" : "A") as Letra })) });
  const r = aplicarChecagem(m0, dez, p);
  assert.ok(r.ok);
  assert.equal(r.exercicios.find((e) => e.ordem === 3)!.situacao, "retido");
  assert.equal(r.material.situacao, "publicado");
});
test("parecer faltando recusa", () => assert.equal(aplicarChecagem(m0, dez, parecer({ exercicios: [] })).ok, false));
test("menos de 5 exercícios retém o material", () => {
  const p = parecer({ exercicios: dez.map((e) => ({ ordem: e.ordem, ok: e.ordem <= 4, resposta_encontrada: "A" as Letra })) });
  const r = aplicarChecagem(m0, dez, p);
  assert.ok(r.ok);
  assert.equal(r.material.situacao, "retido");
  assert.ok(r.material.motivo);
});
test("texto reprovado retém", () => {
  const r = aplicarChecagem(m0, dez, parecer({ texto: { ok: false, problema: "data errada" } }));
  assert.ok(r.ok);
  assert.equal(r.material.situacao, "retido");
  assert.match(r.material.motivo!, /data errada/);
});
test("não republica material em conferência", () => {
  assert.equal(aplicarChecagem({ situacao: "em_conferencia", checagens: 1 }, dez, parecer()).ok, false);
});
test("verificador vazio recusa", () => assert.equal(aplicarChecagem(m0, dez, parecer({ verificador: " " })).ok, false));
test("material publicado aceita só o exercício corrigido, sem parecer do texto", () => {
  const exs = dez.map((e) => (e.ordem === 3 ? e : ex(e.ordem, { situacao: "publicado", checagens: 1 })));
  const r = aplicarChecagem({ situacao: "publicado", checagens: 1 }, exs, { verificador: "s2", texto: null, exercicios: [{ ordem: 3, ok: true, resposta_encontrada: "A" }] });
  assert.ok(r.ok);
  assert.equal(r.material.situacao, "publicado");
  assert.equal(r.exercicios.length, 1);
});
test("material retido é checado de novo e exige o parecer do texto", () => {
  const mr = { situacao: "retido" as SituacaoEstudo, checagens: 1 };
  assert.equal(aplicarChecagem(mr, dez, parecer({ texto: null })).ok, false);
  const r = aplicarChecagem(mr, dez, parecer());
  assert.ok(r.ok);
  assert.equal(r.material.situacao, "publicado");
  assert.equal(r.material.checagens, 2);
});
test("uma correção só", () => {
  assert.equal(podeRegravar(null), true);
  assert.equal(podeRegravar({ situacao: "rascunho", checagens: 0 }), true);
  assert.equal(podeRegravar({ situacao: "retido", checagens: 1 }), true);
  assert.equal(podeRegravar({ situacao: "retido", checagens: 2 }), false);
  assert.equal(podeRegravar({ situacao: "publicado", checagens: 1 }), false);
  assert.equal(podeRegravar({ situacao: "em_conferencia", checagens: 1 }), false);
  const mr1 = { situacao: "retido" as SituacaoEstudo, checagens: 1 };
  assert.equal(podeCorrigirExercicio({ situacao: "retido", checagens: 1 }, mr1), true);
  assert.equal(podeCorrigirExercicio({ situacao: "retido", checagens: 2 }, mr1), false);
  assert.equal(podeCorrigirExercicio({ situacao: "publicado", checagens: 1 }, mr1), false);
});
test("aluno só vê publicado de material publicado", () => {
  assert.equal(visivelAoAluno("publicado", "publicado"), true);
  assert.equal(visivelAoAluno("em_conferencia", "publicado"), false);
  assert.equal(visivelAoAluno("publicado", "retido"), false);
});
test("amostra é fixa e fica perto de 1 em 5", () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `00000000-0000-4000-8000-${String(i * 7919).padStart(12, "0")}`);
  const n = ids.filter(ehAmostra).length;
  assert.ok(n > 120 && n < 280, String(n));
  assert.equal(ehAmostra(ids[0]), ehAmostra(ids[0]));
});
test("exercicioMudou ignora o comentário", () => {
  const a = { enunciado: "a", imagem_id: null, alternativas: [{ letra: "A" as Letra, texto: "x" }], resposta_correta: "A" as Letra };
  assert.equal(exercicioMudou(a, { ...a }), false);
  assert.equal(exercicioMudou(a, { ...a, resposta_correta: "B" }), true);
  assert.equal(exercicioMudou(a, { ...a, alternativas: [{ letra: "A", texto: "y" }] }), true);
});

test("imagemDisponivel: desenho vai ao ar com o material; foto só aprovada", () => {
  assert.equal(imagemDisponivel({ tipo: "desenho", aprovada_em: null }), true);
  assert.equal(imagemDisponivel({ tipo: "foto", aprovada_em: null }), false);
  assert.equal(imagemDisponivel({ tipo: "foto", aprovada_em: "2026-11-04T10:00:00Z" }), true);
});

test("material retido com duas checagens não é checado de novo", () => {
  const r = aplicarChecagem({ situacao: "retido", checagens: 2 }, dez, parecer());
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /já teve duas checagens/);
});
test("material retido por texto reprovado exige regravar", () => {
  const r = aplicarChecagem({ situacao: "retido", checagens: 1, textoReprovado: true }, dez, parecer());
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /regrave o material/);
});
test("material retido sem exercício em rascunho: nada mudou", () => {
  const exs = dez.map((e) => ex(e.ordem, { situacao: "retido", checagens: 1 }));
  const r = aplicarChecagem({ situacao: "retido", checagens: 1 }, exs, parecer({ exercicios: [] }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /Nada mudou/);
});
test("não corrige exercício de material retido que esgotou as checagens ou teve o texto reprovado", () => {
  const e1 = { situacao: "retido" as SituacaoEstudo, checagens: 1 };
  assert.equal(podeCorrigirExercicio(e1, { situacao: "retido", checagens: 2 }), false);
  assert.equal(podeCorrigirExercicio(e1, { situacao: "retido", checagens: 1, textoReprovado: true }), false);
  assert.equal(podeCorrigirExercicio(e1, { situacao: "retido", checagens: 1 }), true);
});

test("só o dono gerencia o estudo", () => {
  assert.equal(podeGerir("dono"), true);
  assert.equal(podeGerir("admin"), false);
  assert.equal(podeGerir("professor"), false);
});
