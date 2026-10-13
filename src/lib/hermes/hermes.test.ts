import { test } from "node:test";
import assert from "node:assert/strict";
import { fecharSaidaPendente, formatarPresenca, mesclarPresenca, presencaTentativa, somarPresencaAula } from "./presenca";
import { normalizarBusca, situacaoTurmaNoSimulado, textoProgressoAula, textoResultadoSimulado } from "./relatorios";
import { podeVerTurma } from "../mcp/escopo";
import { senhaConfere } from "./senha";
import { validarConsultaLivre } from "./consulta-livre";

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

test("somarPresencaAula soma deltas entre visitas, com teto e entrada tolerante", () => {
  const base = { tempo_assistido_seg: 100, saidas: 3, tempo_fora_seg: 60 };
  assert.deepEqual(somarPresencaAula(base, { assistidoDeltaSeg: 15, saidasDelta: 2, foraDeltaSeg: 30 }), { tempo_assistido_seg: 115, saidas: 5, tempo_fora_seg: 90 });
  assert.deepEqual(somarPresencaAula(base, { assistidoDeltaSeg: 9999, saidasDelta: 999, foraDeltaSeg: 99999 }), { tempo_assistido_seg: 220, saidas: 23, tempo_fora_seg: 3660 });
  assert.deepEqual(somarPresencaAula(base, { assistidoDeltaSeg: -5, saidasDelta: NaN, foraDeltaSeg: "x" }), base);
  assert.deepEqual(somarPresencaAula(base, undefined), base);
});

test("podeVerTurma respeita escola e turmas liberadas", () => {
  assert.equal(podeVerTurma({ tipo: "dono" }, "e2", "3ª A"), true);
  const prof = { tipo: "professor" as const, escolaId: "e1", professorId: "p", turmas: new Set(["3ª A"]) };
  assert.equal(podeVerTurma(prof, "e1", "3ª A"), true);
  assert.equal(podeVerTurma(prof, "e1", "3ª B"), false);
  assert.equal(podeVerTurma(prof, "e2", "3ª A"), false);
  assert.equal(podeVerTurma({ ...prof, turmas: null }, "e1", "qualquer"), true);
});

test("senhaConfere", () => {
  assert.equal(senhaConfere("Bearer abc", "abc"), true);
  assert.equal(senhaConfere("Bearer abd", "abc"), false);
  assert.equal(senhaConfere(null, "abc"), false);
  assert.equal(senhaConfere("Bearer ", undefined), false);
});

test("validarConsultaLivre: caso válido com padrões", () => {
  const r = validarConsultaLivre({ tabela: "tentativas", colunas: ["id", "status", "saidas"], filtros: [{ coluna: "status", op: "eq", valor: "entregue" }, { coluna: "entregue_em", op: "not_null" }], ordem: { coluna: "entregue_em" } });
  assert.ok(!("erro" in r));
  assert.deepEqual(r.colunas, ["id", "status", "saidas"]);
  assert.equal(r.limite, 100);
  assert.deepEqual(r.ordem, { coluna: "entregue_em", asc: true });
  const todas = validarConsultaLivre({ tabela: "professores" });
  assert.ok(!("erro" in todas));
  assert.ok(!todas.colunas.includes("senha_hash") && !todas.colunas.includes("token_verificacao"));
});

test("validarConsultaLivre: erros em pt-BR", () => {
  const erro = (e: Parameters<typeof validarConsultaLivre>[0]) => {
    const r = validarConsultaLivre(e);
    return "erro" in r ? r.erro : "";
  };
  assert.match(erro({ tabela: "configuracoes" }), /Tabela "configuracoes" não pode ser consultada/);
  assert.match(erro({ tabela: "constructor" }), /não pode ser consultada/);
  assert.match(erro({ tabela: "professores", colunas: ["nome", "senha_hash"] }), /Coluna "senha_hash" não pode ser consultada/);
  assert.match(erro({ tabela: "alunos_contas", filtros: [{ coluna: "token_verificacao", op: "not_null" }] }), /Coluna "token_verificacao"/);
  assert.match(erro({ tabela: "escolas", colunas: ["codigo_convite_professor"] }), /não pode ser consultada/);
  assert.match(erro({ tabela: "turmas", filtros: [{ coluna: "nome", op: "like", valor: "x" }] }), /Operação "like" inválida/);
  assert.match(erro({ tabela: "turmas", filtros: [{ coluna: "nome", op: "in", valor: "x" }] }), /lista/);
  assert.match(erro({ tabela: "turmas", filtros: [{ coluna: "nome", op: "eq" }] }), /valor/);
  assert.match(erro({ tabela: "turmas", filtros: [{ coluna: "nome", op: "in", valor: ["3ª A", 'x"),nome.eq.(y'] }] }), /não podem conter aspas/);
  assert.match(erro({ tabela: "turmas", filtros: [{ coluna: "nome", op: "in", valor: ["a\\b"] }] }), /barra invertida/);
  const comVirgula = validarConsultaLivre({ tabela: "turmas", filtros: [{ coluna: "nome", op: "in", valor: ["3ª A, tarde", "(x)"] }] });
  assert.ok(!("erro" in comVirgula));
  assert.match(erro({ tabela: "turmas", limite: 0 }), /Limite deve ser um número inteiro entre 1 e 500/);
  assert.match(erro({ tabela: "turmas", limite: 501 }), /entre 1 e 500/);
  assert.match(erro({ tabela: "turmas", ordem: { coluna: "senha_hash" } }), /não pode ser consultada/);
});

test("mesclarPresenca: saidas nunca fica abaixo do número de eventos", () => {
  const ev = (m: number) => ({ questao: null, saiu_em: `2026-10-12T10:0${m}:00Z`, voltou_em: `2026-10-12T10:0${m}:30Z` });
  const r = mesclarPresenca({ saidas: 1, tempoForaSeg: 10, eventos: [ev(1)] }, { saidas: 1, tempoForaSeg: 20, eventos: [ev(2), ev(3)] });
  assert.equal(r.eventos.length, 3);
  assert.equal(r.saidas, 3);
});

test("presencaTentativa: sem medição vira —", () => {
  assert.equal(presencaTentativa({ saidas: 0, tempo_fora_seg: 0, eventos_saida: null }), "—");
  assert.equal(presencaTentativa({ saidas: 0, tempo_fora_seg: 0, eventos_saida: [] }), "nenhuma");
  assert.equal(presencaTentativa({ saidas: 2, tempo_fora_seg: 60, eventos_saida: null }), formatarPresenca(2, 60));
});
