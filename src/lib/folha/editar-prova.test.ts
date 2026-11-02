import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataBR,
  destinoArraste,
  escolherTroca,
  fendaArraste,
  itensLinhaCabecalho,
  lerCabecalho,
  linhasIdentificacao,
  LIMITE_NOME_PROVA,
  mesmaQuestao,
  nomeNaProva,
  reordenar,
  removerDaOrdem,
  trechoEnunciado,
  validarCabecalho,
  validarNomeProva,
} from "./editar-prova";
import { cm, FIM_LINHA } from "./medidas";

test("validarCabecalho: trim, omite vazios e mantém quebras", () => {
  const r = validarCabecalho({ titulo: "  Simulado  ", turma: " 3º A ", data: "2026-11-05", valor: "", instrucoes: "  Use caneta.\nSem consulta.  " });
  assert.deepEqual(r, { ok: true, titulo: "Simulado", cabecalho: { turma: "3º A", data: "2026-11-05", instrucoes: "Use caneta.\nSem consulta." } });
});
test("validarCabecalho: recusa título vazio, longo, data inválida e limites", () => {
  assert.equal(validarCabecalho({ titulo: "   " }).ok, false);
  assert.equal(validarCabecalho({ titulo: "x".repeat(121) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "2026-02-30" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", data: "05/11/2026" }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", turma: "x".repeat(31) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", valor: "x".repeat(16) }).ok, false);
  assert.equal(validarCabecalho({ titulo: "T", instrucoes: "x".repeat(601) }).ok, false);
  assert.deepEqual(validarCabecalho({ titulo: "T", instrucoes: "   \n  " }), { ok: true, titulo: "T", cabecalho: {} });
});
test("lerCabecalho: tolera lixo", () => {
  assert.deepEqual(lerCabecalho(null), {});
  assert.deepEqual(lerCabecalho({ turma: "3A", valor: 10, outra: "x" }), { turma: "3A" });
});
test("lerCabecalho: descarta data inválida", () => {
  assert.deepEqual(lerCabecalho({ turma: "3A", data: "05/11/2026" }), { turma: "3A" });
  assert.deepEqual(lerCabecalho({ data: "2026-02-30" }), {});
  assert.deepEqual(lerCabecalho({ data: "2026-11-05" }), { data: "2026-11-05" });
});
test("validarCabecalho: aceita turma de 30 e valor de 15", () => {
  assert.equal(validarCabecalho({ titulo: "T", turma: "x".repeat(30), valor: "y".repeat(15) }, "y".repeat(15)).ok, true);
  assert.equal(validarCabecalho({ titulo: "T", valor: "y".repeat(16) }, "y".repeat(16)).ok, false);
});
test("mesmaQuestao", () => {
  assert.equal(mesmaQuestao(["a", "b"], 1, "b"), true);
  assert.equal(mesmaQuestao(["a", "b"], 0, "b"), false);
  assert.equal(mesmaQuestao(["a", "b"], 2, "b"), false);
  assert.equal(mesmaQuestao(["a", "b"], -1, "a"), false);
  assert.equal(mesmaQuestao(["a", "b"], 0.5, "a"), false);
});
test("itensLinhaCabecalho: só os preenchidos, na ordem", () => {
  assert.deepEqual(itensLinhaCabecalho({}), []);
  assert.deepEqual(itensLinhaCabecalho({ valor: "10,0", instrucoes: "x" }), [{ rotulo: "Valor", valor: "10,0" }]);
  assert.deepEqual(itensLinhaCabecalho({ valor: "10", data: "2026-11-05", turma: "3A" }).map((i) => i.rotulo), ["Turma", "Data", "Valor"]);
});
test("dataBR", () => assert.equal(dataBR("2026-11-05"), "05/11/2026"));
test("reordenar", () => {
  assert.deepEqual(reordenar(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(reordenar(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.equal(reordenar(["a", "b"], 0, 2), null);
  assert.equal(reordenar(["a", "b"], -1, 0), null);
  assert.equal(reordenar(["a", "b"], 1, 1), null);
});
test("fendaArraste e destinoArraste", () => {
  const meios = [10, 30, 50]; // três linhas
  assert.equal(fendaArraste(meios, 0), 0);
  assert.equal(fendaArraste(meios, 20), 1);
  assert.equal(fendaArraste(meios, 30), 1); // exatamente no meio: ainda antes
  assert.equal(fendaArraste(meios, 45), 2);
  assert.equal(fendaArraste(meios, 99), 3);
  assert.equal(fendaArraste([], 5), 0);
  // Linha 0 arrastada: fendas 0 e 1 = mesmo lugar; fenda 3 = última posição.
  assert.equal(destinoArraste(0, 0), 0);
  assert.equal(destinoArraste(0, 1), 0);
  assert.equal(destinoArraste(0, 2), 1);
  assert.equal(destinoArraste(0, 3), 2);
  // Linha 2 arrastada para o topo.
  assert.equal(destinoArraste(2, 0), 0);
  assert.equal(destinoArraste(2, 2), 2);
  assert.equal(destinoArraste(2, 3), 2);
  // Coerente com reordenar.
  assert.deepEqual(reordenar(["a", "b", "c"], 0, destinoArraste(0, 3)), ["b", "c", "a"]);
});
test("removerDaOrdem", () => {
  assert.deepEqual(removerDaOrdem(["a", "b", "c"], 1), ["a", "c"]);
  assert.equal(removerDaOrdem(["a"], 0), null);
  assert.equal(removerDaOrdem(["a", "b"], 5), null);
});
test("escolherTroca: inédita primeiro, nunca uma da prova", () => {
  assert.deepEqual(escolherTroca(["a", "b", "c"], new Set(["a"]), new Set(["b"]), false, () => 0), { id: "c", usada: false });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), false), { id: null, haUsadas: true });
  assert.deepEqual(escolherTroca(["a", "b"], new Set(["a"]), new Set(["b"]), true), { id: "b", usada: true });
  assert.deepEqual(escolherTroca(["a"], new Set(["a"]), new Set(), true), { id: null, haUsadas: false });
});
test("trechoEnunciado", () => {
  assert.equal(trechoEnunciado("**Leia** o  texto\n<b>abaixo</b>."), "Leia o texto abaixo.");
  assert.equal(trechoEnunciado("x".repeat(100), 90), "x".repeat(89) + "…");
});

test("nomeNaProva: apelido, senão o nome (sem a matéria)", () => {
  assert.equal(nomeNaProva("Fernando Alves", "Cenoura"), "Cenoura");
  assert.equal(nomeNaProva("Fernando Alves", "  Cenoura  "), "Cenoura");
  assert.equal(nomeNaProva(" Fernando Alves ", null), "Fernando Alves");
  assert.equal(nomeNaProva("Fernando Alves", "   "), "Fernando Alves");
});
test("nomeNaProva: sem nome nenhum devolve null (fica o traço)", () => {
  assert.equal(nomeNaProva("", null), null);
  assert.equal(nomeNaProva("  ", " "), null);
  assert.equal(nomeNaProva(null, null), null);
});
test("validarNomeProva: trim, vazio vira null, até 60", () => {
  assert.deepEqual(validarNomeProva("  Cenoura "), { ok: true, valor: "Cenoura" });
  assert.deepEqual(validarNomeProva("   "), { ok: true, valor: null });
  assert.deepEqual(validarNomeProva("x".repeat(LIMITE_NOME_PROVA)), { ok: true, valor: "x".repeat(60) });
  assert.equal(validarNomeProva("x".repeat(61)).ok, false);
});
test("linhasIdentificacao: sem nome, linhas de sempre", () => {
  const sem = linhasIdentificacao({});
  assert.deepEqual(sem, linhasIdentificacao({}, null));
  assert.deepEqual(sem, linhasIdentificacao({}, "   "));
  assert.deepEqual(sem.nomeProfessor, []);
  assert.deepEqual(sem.professor, [
    { rotulo: "Professor(a)", ate: FIM_LINHA - cm(3.8) },
    { rotulo: "Data", ate: null, depois: "____/____/______" },
  ]);
  assert.deepEqual(linhasIdentificacao({ data: "2026-11-05" }).professor, [{ rotulo: "Professor(a)", ate: FIM_LINHA }]);
});
test("linhasIdentificacao: nenhuma linha tem \"Nota\" (a nota vai na caixa)", () => {
  for (const r of [linhasIdentificacao({}), linhasIdentificacao({ data: "2026-11-05", turma: "3A" }, "Cenoura", "Química")]) {
    const rotulos = [...r.aluno, ...r.professor, ...r.nomeProfessor, ...r.informada].map((c) => c.rotulo);
    assert.ok(!rotulos.includes("Nota"), rotulos.join());
  }
});
test("linhasIdentificacao: a disciplina abre a linha de turma/data/valor, longe do nome", () => {
  const r = linhasIdentificacao({ turma: "3A", data: "2026-11-04", valor: "10,0" }, "Cenoura", "Química");
  assert.deepEqual(r.professor, [{ rotulo: "Professor(a)", ate: null, depois: "Cenoura" }]);
  assert.deepEqual(r.informada, [
    { rotulo: "Disciplina", valor: "Química" },
    { rotulo: "Turma", valor: "3A" },
    { rotulo: "Data", valor: "04/11/2026" },
    { rotulo: "Valor", valor: "10,0" },
  ]);
  assert.deepEqual(linhasIdentificacao({}, "Cenoura", "  ").informada, []);
  assert.deepEqual(linhasIdentificacao({}, null, "Química").informada, [{ rotulo: "Disciplina", valor: "Química" }]);
});
test("linhasIdentificacao: nome curto entra como texto no lugar do traço", () => {
  const r = linhasIdentificacao({}, "Cenoura");
  assert.deepEqual(r.nomeProfessor, []);
  assert.deepEqual(r.professor, [
    { rotulo: "Professor(a)", ate: null, depois: "Cenoura" },
    { rotulo: "Data", ate: null, depois: "____/____/______" },
  ]);
  const comData = linhasIdentificacao({ data: "2026-11-05" }, "Cenoura");
  assert.deepEqual(comData.professor, [{ rotulo: "Professor(a)", ate: null, depois: "Cenoura" }]);
  assert.deepEqual(comData.informada.map((i) => i.rotulo), ["Data"]);
});
test("linhasIdentificacao: nome longo vai numa linha própria (sem tab) e a Data segue na de baixo", () => {
  const nome = "N".repeat(60);
  const r = linhasIdentificacao({}, nome);
  assert.deepEqual(r.nomeProfessor, [{ rotulo: "Professor(a)", valor: nome }]);
  assert.deepEqual(r.professor, [{ rotulo: "Data", ate: null, depois: "____/____/______" }]);
  const comData = linhasIdentificacao({ data: "2026-11-05" }, nome);
  assert.deepEqual(comData.nomeProfessor, [{ rotulo: "Professor(a)", valor: nome }]);
  assert.deepEqual(comData.professor, []);
});

test("validarCabecalho: valor numérico é normalizado; o já salvo é mantido", () => {
  assert.deepEqual(validarCabecalho({ titulo: "T", valor: "10 pontos" }, "10 pontos"), {
    ok: true,
    titulo: "T",
    cabecalho: { valor: "10 pontos" },
  });
  const r = validarCabecalho({ titulo: "T", valor: "10" });
  assert.ok(r.ok && r.cabecalho.valor === "10,0");
  assert.equal(validarCabecalho({ titulo: "T", valor: "dez" }).ok, false);
});

test("lerCabecalho: valorPorQuestao só como booleano", () => {
  assert.equal(lerCabecalho({ valorPorQuestao: true }).valorPorQuestao, true);
  assert.equal("valorPorQuestao" in lerCabecalho({ valorPorQuestao: "sim" }), false);
});

test("itensLinhaCabecalho: valor numérico sai formatado", () => {
  assert.deepEqual(itensLinhaCabecalho({ valor: "10" }), [{ rotulo: "Valor", valor: "10,0" }]);
  assert.deepEqual(itensLinhaCabecalho({ valor: "10 pontos" }), [{ rotulo: "Valor", valor: "10 pontos" }]);
});
