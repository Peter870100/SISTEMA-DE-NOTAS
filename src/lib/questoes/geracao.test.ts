import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMIAR_PARECENCA, LIMITE_DIARIO, escolherExemplos, inicioDoDia, instrucoesGeracao, parecenca, respostaParaGeradas, restanteHoje, validarPedido,
  type CandidataExemplo, type ContextoGeradas, type PedidoGeracao, type RespostaGeracao,
} from "./geracao";

const alts = (textos = ["um", "dois", "três", "quatro", "cinco"]) =>
  (["A", "B", "C", "D", "E"] as const).map((letra, i) => ({ letra, texto: textos[i] }));
const item = (o: Partial<RespostaGeracao["questoes"][number]> = {}): RespostaGeracao["questoes"][number] => ({
  enunciado: "A fotossíntese ocorre nos cloroplastos das plantas verdes",
  comando: "Assinale a correta.",
  alternativas: alts(),
  resposta: "C",
  resolucao: "  Porque sim.  ",
  assunto_id: null,
  ...o,
});
const ctx = (o: Partial<ContextoGeradas> = {}): ContextoGeradas => ({
  escopo: "escola", escola_id: "esc-1", materia: "biologia", assuntoPedido: null,
  assuntosValidos: new Set(["as-1", "as-2"]), referencias: [], geracao_id: "ger-1", criado_por: "u-1", ano: 2026, ...o,
});

test("parecenca: iguais = 1, ignora acento e maiúscula", () => {
  assert.equal(parecenca("A Revolução Industrial começou na Inglaterra", "a revolucao industrial comecou na inglaterra"), 1);
});
test("parecenca: textos diferentes ficam perto de 0", () => {
  assert.ok(parecenca("A fotossíntese ocorre nos cloroplastos das plantas", "O preço do produto subiu vinte por cento em março") < 0.1);
});
test("parecenca: texto igual passa do limiar", () => { assert.ok(parecenca("a b c d", "a b c d") >= LIMIAR_PARECENCA); });
test("parecenca: menos de 3 palavras = 0", () => { assert.equal(parecenca("sim não", "sim não"), 0); });

test("respostaParaGeradas: descarta alternativas repetidas, vazias ou ≠ 5", () => {
  const repetidas = alts().map((a, i) => (i === 1 ? { ...a, letra: "A" as const } : a));
  const vazia = alts(["um", " ", "três", "quatro", "cinco"]);
  const quatro = alts().slice(0, 4);
  const r = respostaParaGeradas({ questoes: [item(), item({ alternativas: repetidas }), item({ alternativas: vazia }), item({ alternativas: quatro }), item({ enunciado: "  " })] }, ctx());
  assert.equal(r.linhas.length, 1);
  assert.equal(r.descartadas, 4);
});
test("respostaParaGeradas: descarta alternativas com texto igual (trim + minúsculas)", () => {
  const iguais = alts(["Um", "dois", " um ", "quatro", "cinco"]);
  const r = respostaParaGeradas({ questoes: [item({ alternativas: iguais })] }, ctx());
  assert.equal(r.linhas.length, 0);
  assert.equal(r.descartadas, 1);
});
test("respostaParaGeradas: assunto fora da lista vira o assunto pedido", () => {
  const a = respostaParaGeradas({ questoes: [item({ assunto_id: "inventado" })] }, ctx({ assuntoPedido: "as-1" }));
  assert.equal(a.linhas[0].assunto_id, "as-1");
  const b = respostaParaGeradas({ questoes: [item({ assunto_id: "inventado" })] }, ctx());
  assert.equal(b.linhas[0].assunto_id, null);
  const c = respostaParaGeradas({ questoes: [item({ assunto_id: "as-2" })] }, ctx({ assuntoPedido: "as-1" }));
  assert.equal(c.linhas[0].assunto_id, "as-2");
});
test("respostaParaGeradas: parecida com referência marca revisão com o rótulo", () => {
  const q = item();
  const r = respostaParaGeradas({ questoes: [q] }, ctx({ referencias: [{ rotulo: "ENEM 2019 nº 45", texto: `${q.enunciado} ${q.comando}` }] }));
  assert.equal(r.linhas[0].precisa_revisao, true);
  assert.equal(r.linhas[0].motivo_revisao, "Parecida demais com ENEM 2019 nº 45.");
});
test("respostaParaGeradas: duas geradas iguais entre si → a segunda marcada", () => {
  const r = respostaParaGeradas({ questoes: [item(), item()] }, ctx());
  assert.equal(r.linhas[0].precisa_revisao, false);
  assert.equal(r.linhas[0].motivo_revisao, null);
  assert.equal(r.linhas[1].precisa_revisao, true);
  assert.equal(r.linhas[1].motivo_revisao, "Parecida demais com outra questão gerada.");
});
test("respostaParaGeradas: questão distinta não é marcada", () => {
  const r = respostaParaGeradas({ questoes: [item(), item({ enunciado: "O preço do produto subiu vinte por cento em março", comando: "Calcule o novo valor." })] }, ctx());
  assert.equal(r.linhas[1].precisa_revisao, false);
});
test("respostaParaGeradas: monta a linha com origem ia", () => {
  const r = respostaParaGeradas({ questoes: [item({ alternativas: alts([" a ", "b", "c", "d", "e "]).reverse() })] }, ctx());
  const l = r.linhas[0];
  assert.equal(l.origem, "ia");
  assert.equal(l.status, "revisao");
  assert.equal(l.banca, "Gerada por IA");
  assert.equal(l.caderno, "");
  assert.equal(l.numero, null);
  assert.equal(l.area, "natureza");
  assert.equal(l.materia, "biologia");
  assert.equal(l.resolucao, "Porque sim.");
  assert.equal(l.geracao_id, "ger-1");
  assert.equal(l.criado_por, "u-1");
  assert.equal(l.escopo, "escola");
  assert.equal(l.escola_id, "esc-1");
  assert.equal(l.ano, 2026);
  assert.equal(l.resposta, "C");
  assert.deepEqual(l.alternativas?.map((a) => a.letra), ["A", "B", "C", "D", "E"]);
  assert.equal(l.alternativas?.[0].texto, "a");
  assert.equal(l.alternativas?.[4].texto, "e");
});

const pedidoOk = { materia: "biologia", assunto_id: "as-1", quantidade: 3, dificuldade: "media", orientacao: "  foco em células ", escopo: "escola", base_id: null };
const assuntos = new Set(["as-1", "as-2"]);

test("validarPedido: pedido válido", () => {
  const p = validarPedido(pedidoOk, { role: "professor" }, assuntos);
  assert.equal(p.orientacao, "foco em células");
  assert.equal(p.assunto_id, "as-1");
  assert.equal(p.base_id, null);
});
test("validarPedido: assunto vazio e base vazia viram null", () => {
  const p = validarPedido({ ...pedidoOk, assunto_id: "", base_id: "" }, { role: "professor" }, assuntos);
  assert.equal(p.assunto_id, null);
  assert.equal(p.base_id, null);
});
test("validarPedido: quantidade 0 e 11 recusadas", () => {
  for (const quantidade of [0, 11, 2.5]) {
    assert.throws(() => validarPedido({ ...pedidoOk, quantidade }, { role: "admin" }, assuntos), { message: "Escolha de 1 a 10 questões." });
  }
});
test("validarPedido: matéria inválida e orientação longa", () => {
  assert.throws(() => validarPedido({ ...pedidoOk, materia: "xyz" }, { role: "admin" }, assuntos), { message: "Escolha uma matéria." });
  assert.throws(() => validarPedido({ ...pedidoOk, orientacao: "a".repeat(501) }, { role: "admin" }, assuntos), { message: "A orientação pode ter até 500 caracteres." });
});
test("validarPedido: professor pedindo geral vira escola; dono mantém", () => {
  assert.equal(validarPedido({ ...pedidoOk, escopo: "geral" }, { role: "professor" }, assuntos).escopo, "escola");
  assert.equal(validarPedido({ ...pedidoOk, escopo: "geral" }, { role: "admin" }, assuntos).escopo, "escola");
  assert.equal(validarPedido({ ...pedidoOk, escopo: "geral" }, { role: "dono" }, assuntos).escopo, "geral");
});
test("validarPedido: assunto de outra matéria recusado", () => {
  assert.throws(() => validarPedido({ ...pedidoOk, assunto_id: "outro" }, { role: "admin" }, assuntos), { message: "Esse assunto não é da matéria escolhida." });
});

test("inicioDoDia: 02:30 UTC de 25/10 ainda é 24/10 em Campo Grande", () => {
  assert.equal(inicioDoDia(new Date("2026-10-25T02:30:00Z")).toISOString(), "2026-10-24T04:00:00.000Z");
});
test("inicioDoDia: 15:00 UTC é o mesmo dia", () => {
  assert.equal(inicioDoDia(new Date("2026-10-25T15:00:00Z")).toISOString(), "2026-10-25T04:00:00.000Z");
});
test("restanteHoje: 55 pedidas → 5; passou → 0; dono → null", () => {
  assert.equal(LIMITE_DIARIO, 60);
  assert.equal(restanteHoje(55, "professor"), 5);
  assert.equal(restanteHoje(80, "admin"), 0);
  assert.equal(restanteHoje(80, "dono"), null);
});

const cand = (id: string, assunto_id: string | null, temImagem = false, o: Partial<CandidataExemplo> = {}): CandidataExemplo => ({
  id, rotulo: `ENEM 2020 nº ${id}`, assunto_id, enunciado: `Enunciado ${id}`, comando: `Comando ${id}`,
  alternativas: alts().map((a) => ({ letra: a.letra, texto: `${a.texto} ${id}` })), resposta: "B", temImagem, ...o,
});
const semSorteio = () => 0;

test("escolherExemplos: prefere sem imagem e não passa de 6", () => {
  const c = [cand("i1", "as-1", true), ...Array.from({ length: 8 }, (_, i) => cand(`s${i}`, "as-1"))];
  const r = escolherExemplos(c, "as-1", semSorteio);
  assert.equal(r.length, 6);
  assert.ok(r.every((x) => !x.temImagem));
});
test("escolherExemplos: usa as com imagem se faltar sem imagem", () => {
  const r = escolherExemplos([cand("a", "as-1", true), cand("b", "as-1"), cand("c", "as-1", true), cand("d", "as-1")], "as-1", semSorteio);
  assert.deepEqual(r.map((x) => x.id), ["b", "d", "a", "c"]);
});
test("escolherExemplos: assunto com 2 completa pela matéria; com 3 não completa", () => {
  const outros = [cand("o1", "as-2"), cand("o2", "as-2"), cand("o3", null)];
  const com2 = escolherExemplos([cand("a", "as-1"), cand("b", "as-1"), ...outros], "as-1", semSorteio);
  assert.equal(com2.length, 5);
  assert.deepEqual(com2.slice(0, 2).map((x) => x.id), ["a", "b"]);
  const com3 = escolherExemplos([cand("a", "as-1"), cand("b", "as-1"), cand("c", "as-1"), ...outros], "as-1", semSorteio);
  assert.deepEqual(com3.map((x) => x.id), ["a", "b", "c"]);
});
test("escolherExemplos: sem assunto usa a matéria toda", () => {
  assert.equal(escolherExemplos([cand("a", "as-1"), cand("b", "as-2")], null, semSorteio).length, 2);
});
test("escolherExemplos: lista vazia → []", () => {
  assert.deepEqual(escolherExemplos([], "as-1"), []);
});
test("escolherExemplos: corta enunciado em 2.500 caracteres", () => {
  const r = escolherExemplos([cand("a", "as-1", false, { enunciado: "x".repeat(3000) })], "as-1", semSorteio);
  assert.equal(r[0].enunciado.length, 2500);
});

test("instrucoesGeracao: inclui dificuldade, orientação, modelo principal, recentes e ids dos assuntos", () => {
  const pedido: PedidoGeracao = { materia: "biologia", assunto_id: "as-1", quantidade: 4, dificuldade: "dificil", orientacao: "usar gráfico de barras em texto", escopo: "escola", base_id: "b1" };
  const t = instrucoesGeracao({
    pedido, materiaRotulo: "Biologia", assuntoNome: "Citologia",
    assuntos: [{ id: "as-1", nome: "Citologia" }, { id: "as-2", nome: "Genética" }],
    exemplos: [cand("ex1", "as-1")], base: cand("base1", "as-1"), recentes: ["Questão recente sobre mitose"],
  });
  for (const parte of ["difícil", "usar gráfico de barras em texto", "MODELO PRINCIPAL", "Enunciado base1", "Enunciado ex1", "Resposta correta: B",
    "Já geradas (não repita)", "Questão recente sobre mitose", "as-1 | Citologia", "as-2 | Genética", "Biologia", "4 questões", "inéditas", "LaTeX"]) {
    assert.ok(t.includes(parte), `faltou: ${parte}`);
  }
});
test("instrucoesGeracao: sem base, sem recentes e sem assunto", () => {
  const pedido: PedidoGeracao = { materia: "biologia", assunto_id: null, quantidade: 1, dificuldade: "facil", orientacao: "", escopo: "escola", base_id: null };
  const t = instrucoesGeracao({ pedido, materiaRotulo: "Biologia", assuntoNome: null, assuntos: [], exemplos: [], base: null, recentes: [] });
  assert.ok(t.includes("fácil"));
  assert.ok(!t.includes("MODELO PRINCIPAL"));
  assert.ok(!t.includes("Já geradas"));
});
