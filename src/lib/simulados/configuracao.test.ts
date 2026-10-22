import { test } from "node:test";
import assert from "node:assert/strict";
import { limparConfiguracao, limparFiltros, mudancaProibidaComTentativas, validarOrdem, validarPublicacao, type DadosSimulado } from "./configuracao";

const base: DadosSimulado = {
  titulo: "Simulado 1",
  turmas: [{ turma_nome: "1A", ano_letivo: "2026" }],
  duracaoMin: 90,
  abreEm: "2026-10-20T13:00:00Z",
  fechaEm: "2026-10-21T13:00:00Z",
  correcao: "na_hora",
  embaralhar: false,
};

test("limparConfiguracao: valida título, duração, datas e correção", () => {
  assert.throws(() => limparConfiguracao({ ...base, titulo: "   " }), { message: "Informe o título." });
  assert.throws(() => limparConfiguracao({ ...base, duracaoMin: 0 }), { message: "Duração de 1 a 600 minutos." });
  assert.throws(() => limparConfiguracao({ ...base, duracaoMin: 601 }), { message: "Duração de 1 a 600 minutos." });
  assert.throws(() => limparConfiguracao({ ...base, fechaEm: "2026-10-19T13:00:00Z" }), { message: "A data de fechamento precisa ser depois da abertura." });
  assert.throws(() => limparConfiguracao({ ...base, correcao: "x" as never }), { message: "Escolha quando sai a correção." });
  const c = limparConfiguracao({ ...base, titulo: "  Prova  " });
  assert.deepEqual(c, { titulo: "Prova", duracao_min: 90, abre_em: "2026-10-20T13:00:00.000Z", fecha_em: "2026-10-21T13:00:00.000Z", correcao: "na_hora", embaralhar: false });
});

test("limparFiltros: área inválida e normalização", () => {
  assert.throws(() => limparFiltros({ area: "xyz" as never }), { message: "Área inválida." });
  assert.deepEqual(limparFiltros({ materia: "  Física ", banca: " ", anoDe: 2020 }), { area: undefined, materia: "Física", assunto_id: undefined, banca: undefined, anoDe: 2020, anoAte: undefined });
});

test("mudancaProibidaComTentativas: só título, correção, fechamento e novas turmas", () => {
  const antes = { duracao_min: 90, embaralhar: false, abre_em: "2026-10-20T13:00:00Z" };
  const ligadas = [{ turma_nome: "1A", ano_letivo: "2026" }];
  const c = limparConfiguracao(base);
  assert.equal(mudancaProibidaComTentativas(antes, c, ligadas, base.turmas), false);
  assert.equal(mudancaProibidaComTentativas(antes, limparConfiguracao({ ...base, titulo: "Outro", correcao: "apos_prazo", fechaEm: "2026-10-25T13:00:00Z" }), ligadas, base.turmas), false);
  assert.equal(mudancaProibidaComTentativas(antes, c, ligadas, [...base.turmas, { turma_nome: "1B", ano_letivo: "2026" }]), false);
  assert.equal(mudancaProibidaComTentativas(antes, limparConfiguracao({ ...base, duracaoMin: 60 }), ligadas, base.turmas), true);
  assert.equal(mudancaProibidaComTentativas(antes, limparConfiguracao({ ...base, embaralhar: true }), ligadas, base.turmas), true);
  assert.equal(mudancaProibidaComTentativas(antes, limparConfiguracao({ ...base, abreEm: "2026-10-20T12:00:00Z" }), ligadas, base.turmas), true);
  assert.equal(mudancaProibidaComTentativas(antes, c, ligadas, []), true);
});

test("validarPublicacao", () => {
  const s = { abre_em: "2026-10-20T13:00:00Z", fecha_em: "2026-10-21T13:00:00Z" };
  assert.equal(validarPublicacao(s, 0, 1), "Adicione questões antes de publicar.");
  assert.equal(validarPublicacao(s, 3, 0), "Escolha ao menos uma turma.");
  assert.equal(validarPublicacao({ abre_em: null, fecha_em: s.fecha_em }, 3, 1), "Defina abertura e fechamento.");
  assert.equal(validarPublicacao(s, 3, 1), null);
});

test("validarOrdem", () => {
  const erro = "A nova ordem precisa ter exatamente as mesmas questões.";
  assert.equal(validarOrdem(["a", "b"], ["b", "a"]), null);
  assert.equal(validarOrdem(["a", "b"], ["a"]), erro);
  assert.equal(validarOrdem(["a", "b"], ["a", "c"]), erro);
  assert.equal(validarOrdem(["a", "b"], ["a", "a"]), erro);
});
