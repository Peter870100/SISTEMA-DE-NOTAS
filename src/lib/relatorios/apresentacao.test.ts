import test from "node:test";
import assert from "node:assert/strict";
import { cartaoQuantoFalta, formatarDuracao, pontosBimestres, pontosSimulados, tomQuantoFalta } from "./apresentacao";

test("tom por situação", () => {
  assert.equal(tomQuantoFalta("atingiu"), "ok");
  assert.equal(tomQuantoFalta("precisa"), "gold");
  assert.equal(tomQuantoFalta("impossivel"), "danger");
  assert.equal(tomQuantoFalta("nao_atingiu"), "danger");
  assert.equal(tomQuantoFalta("sem_dados"), "brand");
});

test("cartão: precisa arredonda para cima; impossível mostra o valor", () => {
  assert.equal(cartaoQuantoFalta({ situacao: "precisa", porBimestre: 6.31 }, 6).destaque, "6,4");
  const i = cartaoQuantoFalta({ situacao: "impossivel", porBimestre: 11.2 }, 6);
  assert.equal(i.destaque, "11,2");
  assert.match(i.texto, /Precisaria de 11,2/);
  assert.equal(cartaoQuantoFalta({ situacao: "sem_dados" }, 6).destaque, null);
});

test("duração", () => {
  assert.equal(formatarDuracao(null), "—");
  assert.equal(formatarDuracao(30), "30 s");
  assert.equal(formatarDuracao(1500), "25 min");
  assert.equal(formatarDuracao(3900), "1 h 05 min");
});

test("pontos dos gráficos", () => {
  const b = pontosBimestres([
    { bimestre: "1º", turmaId: "a", media: 7.04, encerrado: true, vigente: false },
    { bimestre: "2º", turmaId: "b", media: null, encerrado: false, vigente: true },
  ]);
  assert.deepEqual(b.map((p) => p.andamento), [false, true]);
  assert.equal(b[0].media, 7);
  const l = (id: string, s: "fez" | "nao_fez", n: number | null, ab: string | null) => ({ simuladoId: id, titulo: id, abreEm: ab, fechaEm: null, situacao: s, nota10: n, tempoSeg: null, saidas: null, tempoForaSeg: null });
  // Só os feitos, na ordem do carregador (sem reordenar).
  const p = pontosSimulados([l("a", "fez", 5, "2026-04-02T10:00:00Z"), l("c", "nao_fez", null, "2026-04-03T10:00:00Z"), l("b", "fez", 8, "2026-05-02T10:00:00Z")]);
  assert.deepEqual(p.map((x) => x.nome), ["a", "b"]);
});
