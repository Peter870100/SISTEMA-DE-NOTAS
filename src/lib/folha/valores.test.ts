import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarDecimos, lerDecimos, validarValoresPedido, valoresDasQuestoes } from "./valores";

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
