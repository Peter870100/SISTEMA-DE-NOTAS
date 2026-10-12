import { test } from "node:test";
import assert from "node:assert/strict";
import { fecharSaidaPendente, formatarPresenca, mesclarPresenca } from "./presenca";
import { normalizarBusca, situacaoTurmaNoSimulado, textoProgressoAula, textoResultadoSimulado } from "./relatorios";

test("mesclarPresenca: nunca diminui, limita e une eventos", () => {
  const a = mesclarPresenca({ saidas: 3, tempoForaSeg: 100, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: "2026-10-12T10:01:00Z" }] },
    { saidas: 2, tempoForaSeg: 150.6, eventos: [{ questao: 2, saiu_em: "2026-10-12T10:00:00Z", voltou_em: null }, { questao: 5, saiu_em: "2026-10-12T10:05:00Z", voltou_em: null }] });
  assert.equal(a.saidas, 3);
  assert.equal(a.tempoForaSeg, 151);
  assert.equal(a.eventos.length, 2);
  assert.equal(mesclarPresenca(null, { saidas: -4, tempoForaSeg: 999999, eventos: "x" }).tempoForaSeg, 6 * 3600);
  assert.equal(mesclarPresenca(null, { saidas: -4 }).saidas, 0);
  const muitos = Array.from({ length: 250 }, (_, i) => ({ questao: 1, saiu_em: new Date(1e12 + i * 1000).toISOString(), voltou_em: null }));
  assert.equal(mesclarPresenca(null, { eventos: muitos }).eventos.length, 200);
});

test("formatarPresenca", () => {
  assert.equal(formatarPresenca(null, null), "—");
  assert.equal(formatarPresenca(0, 0), "nenhuma");
  assert.equal(formatarPresenca(1, 65), "1 saída · 1:05 fora");
  assert.equal(formatarPresenca(3, 160), "3 saídas · 2:40 fora");
});

test("normalizarBusca", () => assert.equal(normalizarBusca("  3ª Série  A "), "3a serie a"));

test("situacaoTurmaNoSimulado e texto", () => {
  const ini = "2026-10-12T10:00:00Z";
  const t = [["c1", { status: "entregue", porcentagem: 80, acertos: 8, total: 10, iniciada_em: ini, entregue_em: "2026-10-12T10:30:00Z", prazo_em: null, tempo_usado_seg: 0, saidas: 2, tempo_fora_seg: 40 }],
    ["c2", { status: "em_andamento", porcentagem: null, acertos: null, total: null, iniciada_em: ini, entregue_em: null, prazo_em: null, tempo_usado_seg: 0, saidas: 0, tempo_fora_seg: 0 }]];
  const l = situacaoTurmaNoSimulado([{ contaId: "c3", nome: "Carla" }, { contaId: "c1", nome: "Ana" }, { contaId: "c2", nome: "Bruno" }], new Map(t as never), "professor");
  assert.deepEqual(l.map((x) => [x.nome, x.status]), [["Ana", "entregue"], ["Bruno", "em_andamento"], ["Carla", "nao_comecou"]]);
  assert.equal(l[0].tempoSeg, 1800);
  const txt = textoResultadoSimulado("Ufms 24", l, []);
  assert.match(txt, /1 entregou · 1 em andamento · 1 não começou/);
  assert.match(txt, /Ana — 80% \(8\/10\) · 30:00 · 2 saídas · 0:40 fora/);
  assert.equal(textoResultadoSimulado("X", [], []).includes("Nenhum aluno"), true);
});

test("textoProgressoAula", () => {
  assert.equal(textoProgressoAula(0, 600, 0, false, 0, 0), "não assistiu");
  assert.equal(textoProgressoAula(600, 600, 700, true, 0, 0), "concluída · 11:40 assistidos");
  assert.equal(textoProgressoAula(760, 1080, 1390, false, 2, 65), "assistiu até 12:40 de 18:00 (70%) · 23:10 assistidos · 2 saídas · 1:05 fora");
});

test("fecharSaidaPendente fecha a saida aberta e limita a 30 min", () => {
  const base = { saidas: 1, tempoForaSeg: 10, eventos: [{ questao: 1, saiu_em: "2026-10-12T10:00:00.000Z", voltou_em: null }] };
  const curta = fecharSaidaPendente(base, new Date("2026-10-12T10:05:00.000Z"));
  assert.equal(curta.tempoForaSeg, 310);
  assert.equal(curta.eventos[0].voltou_em, "2026-10-12T10:05:00.000Z");
  const longa = fecharSaidaPendente(base, new Date("2026-10-12T11:00:00.000Z"));
  assert.equal(longa.tempoForaSeg, 10);
  assert.notEqual(longa.eventos[0].voltou_em, null);
  const fechada = { ...curta };
  assert.equal(fecharSaidaPendente(fechada, new Date()), fechada);
});
