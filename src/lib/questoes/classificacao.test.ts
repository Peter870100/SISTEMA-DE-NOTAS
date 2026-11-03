import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_LOTE, validarItens, mesmoAssunto, mesmaArea, habilidadesFinais, planoJuntarTopicos, nomeNormalizado, mesclarItens,
  contarPorTopico, normalizarLinkHttps, buscarPorTexto, ordenarHabilidades,
  type QuestaoLote, type ItemLote,
} from "./classificacao";
import type { Ator } from "./regras";

const dono: Ator = { id: "d", role: "dono", escola_id: "e1" };
const prof: Ator = { id: "p", role: "professor", escola_id: "e1" };

const q = (id: string, o: Partial<QuestaoLote> = {}): QuestaoLote => ({
  id, assunto_id: "a1", area: "matematica", escopo: "escola", escola_id: "e1", criado_por: "p", ...o,
});
const questoes = new Map<string, QuestaoLote>([
  ["q1", q("q1")],
  ["geral", q("geral", { escopo: "geral", escola_id: null, criado_por: null })],
]);
const topicos = new Map([["t1", { assunto_id: "a1" }], ["t2", { assunto_id: "a2" }]]);
const habilidades = new Map<string, { area: "matematica" | "humanas" }>([["h1", { area: "matematica" }], ["h2", { area: "humanas" }]]);

const rodar = (itens: ItemLote[], ator = prof) => validarItens(itens, questoes, topicos, habilidades, ator);

test("recusa questão inexistente", () => {
  assert.deepEqual(rodar([{ questaoId: "x" }]).recusados, [{ questaoId: "x", motivo: "Questão não encontrada." }]);
});
test("professor não edita questão do banco geral; dono sim", () => {
  assert.equal(rodar([{ questaoId: "geral" }]).recusados[0].motivo, "Sem permissão para editar esta questão.");
  assert.equal(rodar([{ questaoId: "geral" }], dono).aceitos.length, 1);
});
test("recusa tópico inexistente e de outro assunto", () => {
  assert.equal(rodar([{ questaoId: "q1", topicoId: "zz" }]).recusados[0].motivo, "Tópico não encontrado.");
  assert.equal(rodar([{ questaoId: "q1", topicoId: "t2" }]).recusados[0].motivo, "O tópico é de outro assunto.");
});
test("recusa habilidade inexistente e de outra área", () => {
  assert.equal(rodar([{ questaoId: "q1", habilidadeIds: ["zz"] }]).recusados[0].motivo, "Habilidade não encontrada.");
  assert.equal(rodar([{ questaoId: "q1", habilidadeIds: ["h1", "h2"] }]).recusados[0].motivo, "A habilidade é de outra área.");
});
test("válidos seguem junto com inválidos", () => {
  const r = rodar([{ questaoId: "q1", topicoId: "t1", habilidadeIds: ["h1"] }, { questaoId: "x" }, { questaoId: "q1", topicoId: null }]);
  assert.equal(r.aceitos.length, 2);
  assert.equal(r.recusados.length, 1);
});
test("mais de 50 itens lança erro", () => {
  const itens = Array.from({ length: LIMITE_LOTE + 1 }, () => ({ questaoId: "q1" }));
  assert.throws(() => rodar(itens), /No máximo 50 questões por vez\./);
  assert.doesNotThrow(() => rodar(itens.slice(0, 50)));
});
test("habilidadesFinais", () => {
  assert.deepEqual(habilidadesFinais(["a", "b"], ["b", "c", "c"], "adicionar"), ["a", "b", "c"]);
  assert.deepEqual(habilidadesFinais(["a", "b"], ["c", "c", "d"], "trocar"), ["c", "d"]);
});
test("mesmoAssunto e mesmaArea", () => {
  assert.equal(mesmoAssunto([q("1"), q("2")]), "a1");
  assert.equal(mesmoAssunto([q("1"), q("2", { assunto_id: "a2" })]), null);
  assert.equal(mesmoAssunto([q("1", { assunto_id: null })]), null);
  assert.equal(mesmoAssunto([]), null);
  assert.equal(mesmaArea([q("1"), q("2")]), "matematica");
  assert.equal(mesmaArea([q("1"), q("2", { area: "humanas" })]), null);
});
test("nomeNormalizado", () => {
  assert.equal(nomeNormalizado("  Derivação "), "derivacao");
});
test("planoJuntarTopicos", () => {
  const p = planoJuntarTopicos(
    [{ id: "o1", nome: "Derivação" }, { id: "o2", nome: "Limites" }],
    [{ id: "d1", nome: "derivacao" }],
  );
  assert.deepEqual(p, { mover: ["o2"], juntar: [{ de: "o1", para: "d1" }] });
});

test("mesclarItens: junta repetidas, soma habilidades e o último tópico vence", () => {
  const r = mesclarItens([
    { questaoId: "a", topicoId: "t1", habilidadeIds: ["h1", "h2"] },
    { questaoId: "b" },
    { questaoId: "a", topicoId: "t2", habilidadeIds: ["h2", "h3"] },
    { questaoId: "a" },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { questaoId: "a", topicoId: "t2", habilidadeIds: ["h1", "h2", "h3"] });
  assert.deepEqual(r[1], { questaoId: "b" });
});

test("mesclarItens: sem habilidades informadas continua indefinido", () => {
  const r = mesclarItens([{ questaoId: "a", topicoId: null }, { questaoId: "a", topicoId: "t" }]);
  assert.equal(r[0].habilidadeIds, undefined);
  assert.equal(r[0].topicoId, "t");
});

test("contarPorTopico: uma contagem por tópico, ignorando questões sem tópico", () => {
  assert.deepEqual(contarPorTopico([{ topico_id: "a" }, { topico_id: null }, { topico_id: "b" }, { topico_id: "a" }]), { a: 2, b: 1 });
  assert.deepEqual(contarPorTopico([]), {});
});

test("normalizarLinkHttps: aceita https em qualquer caixa e devolve o esquema em minúsculas", () => {
  assert.equal(normalizarLinkHttps("  https://exemplo.com/aula?x=1  "), "https://exemplo.com/aula?x=1");
  assert.equal(normalizarLinkHttps("HTTPS://Exemplo.com/Aula"), "https://Exemplo.com/Aula");
  assert.equal(normalizarLinkHttps("Https://exemplo.com"), "https://exemplo.com");
});

test("normalizarLinkHttps: recusa http, outros esquemas, vazio, sem endereço e com espaço", () => {
  for (const ruim of ["http://exemplo.com", "ftp://exemplo.com", "exemplo.com", "javascript:alert(1)", "", "https://", "https:// exemplo.com", "https://exe mplo.com"]) {
    assert.equal(normalizarLinkHttps(ruim), null, ruim);
  }
});

test("buscarPorTexto: todas as palavras, sem acento, começo do nome primeiro e limite", () => {
  const itens = [
    { nome: "Derivação parassintética", rotulo: "Português · Morfologia" },
    { nome: "Derivadas", rotulo: "Matemática · Cálculo" },
    { nome: "Regra da cadeia", rotulo: "Matemática · Derivação" },
    { nome: "Funções", rotulo: "Matemática · Álgebra" },
  ];
  assert.deepEqual(buscarPorTexto(itens, "derivacao").map((i) => i.nome), ["Derivação parassintética", "Regra da cadeia"]);
  assert.deepEqual(buscarPorTexto(itens, "matematica deriv").map((i) => i.nome), ["Derivadas", "Regra da cadeia"]);
  assert.deepEqual(buscarPorTexto(itens, "   "), []);
  assert.deepEqual(buscarPorTexto(itens, "a", 2).length, 2);
});

test("ordenarHabilidades: por área, código pelo número (H2 antes de H10), sem código no fim", () => {
  const h = (area: "linguagens" | "matematica", codigo: string | null, descricao: string) => ({ area, codigo, descricao });
  const ordem = ordenarHabilidades([
    h("matematica", "H10", "dez"), h("matematica", null, "sem código"), h("matematica", "H2", "dois"),
    h("linguagens", "H30", "trinta"), h("matematica", "H1", "um"), h("linguagens", "H3", "três"),
  ]);
  assert.deepEqual(ordem.map((x) => `${x.area}:${x.codigo ?? "-"}`), [
    "linguagens:H3", "linguagens:H30", "matematica:H1", "matematica:H2", "matematica:H10", "matematica:-",
  ]);
});
