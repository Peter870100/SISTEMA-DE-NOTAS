import { test } from "node:test";
import assert from "node:assert/strict";
import { aceitaResposta, acumularTempo, correcaoLiberada, corrigir, ordemEmbaralhada, prazoFinal, situacaoSimulado, sortear, tempoEsgotado } from "./regras";

const T0 = new Date("2026-10-20T13:00:00Z");
const mais = (seg: number) => new Date(T0.getTime() + seg * 1000);

test("prazoFinal: duração ou fecha_em, o que vier antes", () => {
  assert.equal(prazoFinal(T0, 60, null)!.toISOString(), mais(3600).toISOString());
  assert.equal(prazoFinal(T0, 60, mais(1800))!.toISOString(), mais(1800).toISOString());
  assert.equal(prazoFinal(T0, null, mais(600))!.toISOString(), mais(600).toISOString());
  assert.equal(prazoFinal(T0, null, null), null);
});

test("aceitaResposta: tolerância de 30 s", () => {
  assert.equal(aceitaResposta(mais(100), mais(100)), true);
  assert.equal(aceitaResposta(mais(130), mais(100)), true);
  assert.equal(aceitaResposta(mais(131), mais(100)), false);
  assert.equal(aceitaResposta(mais(99999), null), true);
});

test("acumularTempo: pulsos normais somam, lacuna longa conta no máximo 20 s", () => {
  assert.equal(acumularTempo(0, null, T0), 0);
  assert.equal(acumularTempo(100, T0, mais(15)), 115);
  assert.equal(acumularTempo(100, T0, mais(3600)), 120);
  assert.equal(acumularTempo(100, mais(60), T0), 100); // relógio para trás não desconta
  assert.equal(tempoEsgotado(600, 10), true);
  assert.equal(tempoEsgotado(599, 10), false);
  assert.equal(tempoEsgotado(99999, null), false);
});

test("corrigir: brancos, anuladas e por área", () => {
  const gab = new Map([
    ["q1", { resposta: "A" as const, anulada: false, area: "natureza" as const }],
    ["q2", { resposta: "B" as const, anulada: false, area: "natureza" as const }],
    ["q3", { resposta: "C" as const, anulada: true, area: "matematica" as const }],
    ["q4", { resposta: "D" as const, anulada: false, area: "matematica" as const }],
  ]);
  const r = corrigir(new Map([["q1", "A" as const], ["q2", "C" as const], ["q3", null], ["q4", null]]), gab);
  assert.equal(r.acertos, 2); // q1 certa, q3 anulada
  assert.equal(r.total, 4);
  assert.equal(r.porcentagem, 50);
  assert.deepEqual(r.porArea, { natureza: { acertos: 1, total: 2 }, matematica: { acertos: 1, total: 2 } });
  assert.equal(r.corretas.get("q2"), false);
  assert.equal(r.corretas.get("q3"), true);
  assert.deepEqual(corrigir(new Map(), new Map()), { acertos: 0, total: 0, porcentagem: 0, porArea: {}, corretas: new Map() });
  assert.equal(corrigir(new Map([["q1", "A" as const]]), new Map([...gab].slice(0, 3))).porcentagem, 66.67);
});

test("correcaoLiberada", () => {
  assert.equal(correcaoLiberada({ tipo: "treino", correcao: "apos_prazo", fecha_em: null }, T0), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "na_hora", fecha_em: mais(100).toISOString() }, T0), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, T0), false);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, mais(100)), false);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, mais(129)), false);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: mais(100).toISOString() }, mais(130)), true);
  assert.equal(correcaoLiberada({ tipo: "professor", correcao: "apos_prazo", fecha_em: null }, T0), false);
});

test("ordemEmbaralhada: estável para a mesma semente e é permutação", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `q${i}`);
  const a = ordemEmbaralhada(ids, "tentativa-1");
  assert.deepEqual(a, ordemEmbaralhada(ids, "tentativa-1"));
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.notDeepEqual(a, ordemEmbaralhada(ids, "tentativa-2"));
  assert.notDeepEqual(a, ids);
});

test("sortear: sem repetir e limita ao disponível", () => {
  const s = sortear([1, 2, 3, 4, 5], 3);
  assert.equal(s.length, 3);
  assert.equal(new Set(s).size, 3);
  assert.equal(sortear([1, 2], 10).length, 2);
  assert.deepEqual(sortear([], 5), []);
});

test("situacaoSimulado", () => {
  const base = { status: "publicado" as const, abre_em: mais(100).toISOString(), fecha_em: mais(200).toISOString() };
  assert.equal(situacaoSimulado({ ...base, status: "rascunho" }, T0), "rascunho");
  assert.equal(situacaoSimulado(base, T0), "agendado");
  assert.equal(situacaoSimulado(base, mais(150)), "aberto");
  assert.equal(situacaoSimulado(base, mais(200)), "encerrado");
  assert.equal(situacaoSimulado({ status: "publicado", abre_em: null, fecha_em: null }, T0), "aberto");
});
