import { test } from "node:test";
import assert from "node:assert/strict";
import { RECUSA_EM_ANDAMENTO, regraNovaTentativa } from "./regras";

const agora = new Date("2026-10-23T12:00:00Z");
const daqui = (seg: number) => new Date(agora.getTime() + seg * 1000).toISOString();

test("regraNovaTentativa: em andamento com prazo futuro e sem a flag → recusa", () => {
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: daqui(600) }, agora, false), RECUSA_EM_ANDAMENTO);
  assert.equal(RECUSA_EM_ANDAMENTO, "O aluno está fazendo a prova agora; encerre antes.");
});

test("regraNovaTentativa: em andamento sem prazo (treino) e sem a flag → recusa", () => {
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: null }, agora, false), RECUSA_EM_ANDAMENTO);
});

test("regraNovaTentativa: dentro da tolerância depois do prazo ainda conta como fazendo", () => {
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: daqui(-10) }, agora, false), RECUSA_EM_ANDAMENTO);
});

test("regraNovaTentativa: com a flag mesmo_em_andamento → null", () => {
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: daqui(600) }, agora, true), null);
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: null }, agora, true), null);
});

test("regraNovaTentativa: entregue → null", () => {
  assert.equal(regraNovaTentativa({ status: "entregue", prazo_em: daqui(600) }, agora, false), null);
  assert.equal(regraNovaTentativa({ status: "entregue", prazo_em: null }, agora, false), null);
});

test("regraNovaTentativa: em andamento com prazo vencido → null", () => {
  assert.equal(regraNovaTentativa({ status: "em_andamento", prazo_em: daqui(-3600) }, agora, false), null);
});
