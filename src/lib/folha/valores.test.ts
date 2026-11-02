import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decimosDeNumero,
  decimosParaBanco,
  excessoFixos,
  formatarDecimos,
  lerDecimos,
  validarValoresPedido,
  valoresDasQuestoes,
  valoresDoPainel,
  valoresPorId,
} from "./valores";

test("lerDecimos: aceita vírgula e ponto, recusa o resto", () => {
  assert.equal(lerDecimos("10"), 100);
  assert.equal(lerDecimos("7,5"), 75);
  assert.equal(lerDecimos(" 7.5 "), 75);
  assert.equal(lerDecimos("1000"), 10000);
  for (const ruim of ["0", "-1", "10,25", "10 pontos", "1001", "", "  ", null, undefined]) {
    assert.equal(lerDecimos(ruim as string | null | undefined), null, String(ruim));
  }
});

test("formatarDecimos: uma casa com vírgula", () => {
  assert.equal(formatarDecimos(100), "10,0");
  assert.equal(formatarDecimos(5), "0,5");
});

test("valoresDasQuestoes: divide em décimos exatos, sobra nas últimas", () => {
  assert.deepEqual(valoresDasQuestoes(100, [null, null, null], true).porQuestao, [33, 33, 34]);
  assert.deepEqual(valoresDasQuestoes(10, [null, null, null], true).porQuestao, [3, 3, 4]);
  assert.deepEqual(
    valoresDasQuestoes(100, [20, ...Array(9).fill(null)], true).porQuestao,
    [20, 8, 9, 9, 9, 9, 9, 9, 9, 9],
  );
});

test("valoresDasQuestoes: desligado ou sem total não mostra", () => {
  assert.deepEqual(valoresDasQuestoes(100, [null], false), { porQuestao: null, aviso: null });
  assert.deepEqual(valoresDasQuestoes(null, [null], true), { porQuestao: null, aviso: null });
});

test("valoresDasQuestoes: fixos acima do total", () => {
  assert.deepEqual(valoresDasQuestoes(100, [120, null], true), {
    porQuestao: null,
    aviso: "Os valores fixos (12,0) passam do valor da prova (10,0).",
  });
});

test("valoresDasQuestoes: todas fixas que não fecham o total", () => {
  assert.deepEqual(valoresDasQuestoes(100, [30, 30, 30], true), {
    porQuestao: [30, 30, 30],
    aviso: "As questões somam 9,0 e a prova vale 10,0.",
  });
  assert.equal(valoresDasQuestoes(90, [30, 30, 30], true).aviso, null);
});

test("validarValoresPedido", () => {
  assert.equal(validarValoresPedido(3, null, [{ numero: 1, valor: 10 }]).ok, false);
  assert.deepEqual(validarValoresPedido(3, null, []), { ok: true, fixos: [null, null, null] });
  assert.equal(validarValoresPedido(3, 100, [{ numero: 0, valor: 10 }]).ok, false);
  assert.equal(validarValoresPedido(3, 100, [{ numero: 4, valor: 10 }]).ok, false);
  assert.equal(
    validarValoresPedido(3, 100, [{ numero: 1, valor: 10 }, { numero: 1, valor: 20 }]).ok,
    false,
  );
  assert.equal(validarValoresPedido(3, 100, [{ numero: 1, valor: 60 }, { numero: 2, valor: 50 }]).ok, false);
  assert.deepEqual(validarValoresPedido(3, 100, [{ numero: 3, valor: 20 }]), { ok: true, fixos: [null, null, 20] });
});

test("valoresPorId: só as questões que ainda existem, na ordem certa", () => {
  const r = valoresPorId(["a", "b", "c"], [null, null, null], 100, true);
  assert.deepEqual([...r.porId!.entries()], [["a", "3,3"], ["b", "3,3"], ["c", "3,4"]]);
  assert.equal(valoresPorId(["a"], [null], 100, false).porId, null);
  assert.equal(valoresPorId(["a", "b"], [60, 60], 100, true).porId, null);
});

test("excessoFixos: só recusa acima de um total válido", () => {
  assert.equal(excessoFixos(null, [500, null]), null);
  assert.equal(excessoFixos(100, [50, 50, null]), null);
  assert.equal(excessoFixos(100, [60, null, 50]), "Os valores fixos (11,0) passam do valor da prova (10,0).");
});

test("valoresDoPainel: sugere só nas automáticas e avisa", () => {
  assert.deepEqual(valoresDoPainel(100, [20, null, null]), { sugeridos: [null, 40, 40], aviso: null });
  assert.deepEqual(valoresDoPainel(null, [null, null]), { sugeridos: [null, null], aviso: null });
  assert.deepEqual(valoresDoPainel(null, [20, null]), {
    sugeridos: [null, null],
    aviso: "Preencha o valor da prova para os valores aparecerem.",
  });
  assert.deepEqual(valoresDoPainel(100, [60, 60, null]), {
    sugeridos: [null, null, null],
    aviso: "Os valores fixos (12,0) passam do valor da prova (10,0).",
  });
  assert.deepEqual(valoresDoPainel(100, [40, 50]), {
    sugeridos: [null, null],
    aviso: "As questões somam 9,0 e a prova vale 10,0.",
  });
});

test("decimosParaBanco: ponto e uma casa", () => {
  assert.equal(decimosParaBanco(15), "1.5");
  assert.equal(decimosParaBanco(5), "0.5");
  assert.equal(decimosParaBanco(100), "10.0");
});

test("decimosDeNumero: até 1 casa, > 0 e <= 1000", () => {
  assert.equal(decimosDeNumero(10), 100);
  assert.equal(decimosDeNumero(7.5), 75);
  assert.equal(decimosDeNumero(0.1 + 0.2), 3);
  assert.equal(decimosDeNumero(1.25), null);
  assert.equal(decimosDeNumero(0), null);
  assert.equal(decimosDeNumero(1001), null);
});
