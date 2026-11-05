import { test } from "node:test";
import assert from "node:assert/strict";
import { criarTreinoDoPlanoCom, type DepsTreinoPlano } from "./nucleo";
import { REGRAS_PADRAO } from "./regras";
import type { ConteudoPlano, Etapa, EtapaPlano } from "./tipos";
import type { Candidata } from "./selecao";

const UUID = "11111111-1111-4111-8111-111111111111";
const etapa = (tipo: Etapa["tipo"], estado: Etapa["estado"], treinoAberto: string | null = null): Etapa =>
  ({ tipo, estado, minutos: 10, disponivelEm: null, treinoAberto, resultado: null });

function plano(situacao: ConteudoPlano["situacao"], etapas: Etapa[]): ConteudoPlano {
  return { chave: UUID, nome: "Porcentagem", situacao, etapas, foco: null } as unknown as ConteudoPlano;
}
const cand = (id: string): Candidata => ({ id, topicoId: null, habilidadeIds: [], ultimaVez: null });

function montar(o: {
  plano?: ConteudoPlano | null; candidatas?: Candidata[]; aberto?: string | null; contar?: number;
  insercao?: { simuladoId: string } | "colisao"; facil?: Record<string, number | null>;
}) {
  const chamadas: { inserir: Parameters<DepsTreinoPlano["inserirTreino"]>[0][] } = { inserir: [] };
  const deps: DepsTreinoPlano = {
    conteudo: async () => (o.plano === null ? null : { plano: o.plano ?? plano("revisar", [etapa("revisar", "feita"), etapa("pratica", "disponivel")]), habilidadeIds: [] }),
    candidatas: async () => o.candidatas ?? [cand("a"), cand("b"), cand("c"), cand("d"), cand("e"), cand("f")],
    facilidade: async () => o.facil ?? {},
    treinoAberto: async () => o.aberto ?? null,
    contarTreinos: async () => o.contar ?? 0,
    inserirTreino: async (t) => { chamadas.inserir.push(t); return o.insercao ?? { simuladoId: "novo" }; },
    regras: REGRAS_PADRAO, agora: new Date("2026-11-03T12:00:00Z"), sortear: () => 0,
  };
  return { deps, chamadas };
}
const pedir = (deps: DepsTreinoPlano, etapa: EtapaPlano = "pratica", conteudo = UUID) => criarTreinoDoPlanoCom(deps, { conteudo, etapa });

test("chave inválida e etapa inválida", async () => {
  const { deps } = montar({});
  assert.deepEqual(await pedir(deps, "pratica", "materia:xyz"), { ok: false, erro: "Conteúdo inválido." });
  assert.deepEqual(await pedir(deps, "outra" as EtapaPlano), { ok: false, erro: "Etapa inválida." });
});

test("fora do plano", async () => {
  const { deps } = montar({ plano: null });
  assert.deepEqual(await pedir(deps), { ok: false, erro: "Este conteúdo não está no seu plano." });
});

test("etapa não permitida", async () => {
  const a = montar({});
  assert.deepEqual(await pedir(a.deps, "diagnostico"), { ok: false, erro: "Esta etapa ainda não está disponível." });
  const b = montar({ plano: plano("revisar", [etapa("revisar", "feita"), etapa("pratica", "feita"), etapa("revisao", "aguardando")]) });
  assert.deepEqual(await pedir(b.deps, "revisao"), { ok: false, erro: "Esta etapa ainda não está disponível." });
  const c = montar({ plano: plano("mais_respostas", [etapa("diagnostico", "disponivel")]) });
  assert.equal((await pedir(c.deps, "pratica")).ok, false);
  assert.equal((await pedir(c.deps, "diagnostico")).ok, true);
});

test("treino aberto do plano é reutilizado", async () => {
  const { deps, chamadas } = montar({ plano: plano("revisar", [etapa("pratica", "disponivel", "aberto1")]) });
  assert.deepEqual(await pedir(deps), { ok: true, simuladoId: "aberto1", aviso: null });
  assert.equal(chamadas.inserir.length, 0);
});

test("treinoAberto null no plano ignora treino velho de deps", async () => {
  const { deps, chamadas } = montar({ aberto: "velho" });
  assert.deepEqual(await pedir(deps), { ok: true, simuladoId: "novo", aviso: null });
  assert.equal(chamadas.inserir.length, 1);
});

test("zero candidatas", async () => {
  const { deps } = montar({ candidatas: [] });
  assert.deepEqual(await pedir(deps), { ok: false, erro: "Não há questões novas de Porcentagem no banco agora." });
});

test("poucas candidatas: aviso e ordem de facilidade", async () => {
  const { deps, chamadas } = montar({ candidatas: [cand("a"), cand("b"), cand("c")], facil: { a: 10, b: 90, c: 50 } });
  const r = await pedir(deps);
  assert.deepEqual(r, { ok: true, simuladoId: "novo", aviso: "Só há 3 questões novas de Porcentagem agora; a sequência terá 3." });
  assert.deepEqual(chamadas.inserir[0].questaoIds, ["b", "c", "a"]);
});

test("rodada, título e chave de matéria", async () => {
  const { deps, chamadas } = montar({ contar: 2 });
  await pedir(deps);
  assert.equal(chamadas.inserir[0].rodada, 3);
  assert.equal(chamadas.inserir[0].titulo, "Prática: Porcentagem");
  assert.equal(chamadas.inserir[0].etapa, "pratica");
  const m = montar({});
  assert.equal((await pedir(m.deps, "pratica", "materia:matematica")).ok, true);
});

test("colisão devolve o treino criado pela outra chamada", async () => {
  const a = montar({ insercao: "colisao", aberto: "outro" });
  assert.deepEqual(await pedir(a.deps), { ok: true, simuladoId: "outro", aviso: null });
  const b = montar({ insercao: "colisao", aberto: null });
  assert.deepEqual(await pedir(b.deps), { ok: false, erro: "Tente de novo." });
});

test("prática já aprovada não pode ser refeita antes da revisão", async () => {
  for (const revisao of ["aguardando", "disponivel"] as const) {
    const c = montar({ plano: plano("revisar", [etapa("revisar", "feita"), etapa("pratica", "feita"), etapa("revisao", revisao)]) });
    assert.deepEqual(await pedir(c.deps, "pratica"), { ok: false, erro: "Esta etapa ainda não está disponível." });
    assert.equal(c.chamadas.inserir.length, 0);
  }
});
