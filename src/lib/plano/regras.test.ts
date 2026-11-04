import { test } from "node:test";
import assert from "node:assert/strict";
import { REGRAS_PADRAO, LIMITES, normalizarRegras, validarRegras, tempoSemanaValido } from "./regras";

test("normalizarRegras: nulo, lixo e parcial caem no padrão campo a campo", () => {
  assert.deepEqual(normalizarRegras(null), REGRAS_PADRAO);
  assert.deepEqual(normalizarRegras("x"), REGRAS_PADRAO);
  const r = normalizarRegras({ taxaErroPrioridade: "abc", minQuestoesPrioridade: 8, diasRevisao: 0, metaAcerto: 70.5 });
  assert.equal(r.taxaErroPrioridade, 60); assert.equal(r.minQuestoesPrioridade, 8);
  assert.equal(r.diasRevisao, 7); /* fora do limite */ assert.equal(r.metaAcerto, 60); /* não inteiro */
});
test("validarRegras: exige os 10 inteiros dentro dos limites e diz qual está errado", () => {
  assert.deepEqual(validarRegras(REGRAS_PADRAO), { ok: true, regras: REGRAS_PADRAO });
  const e = validarRegras({ ...REGRAS_PADRAO, questoesPratica: 20 });
  assert.equal(e.ok, false); assert.match((e as { erro: string }).erro, /Questões na prática: use um número inteiro de 3 a 15\./);
  assert.equal(validarRegras({ ...REGRAS_PADRAO, metaAcerto: undefined }).ok, false);
});
test("tempoSemanaValido: só as opções da lista", () => {
  assert.ok(tempoSemanaValido(120)); assert.ok(!tempoSemanaValido(45)); assert.ok(!tempoSemanaValido("120"));
});
test("LIMITES: o padrão de cada regra está dentro dos limites", () => {
  for (const [k, l] of Object.entries(LIMITES)) {
    const v = REGRAS_PADRAO[k as keyof typeof REGRAS_PADRAO];
    assert.ok(v >= l.min && v <= l.max, k);
  }
});
