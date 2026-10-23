import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ctx } from "../leitura/comum";
import { escolaParaCriar } from "./ator";
import {
  ERRO_IMPORTACAO, lerPedidoImportacao, paginasDoTexto, parametrosParaRegistro, selecionarPaginas, textoImportacaoCriada, textoSituacao,
} from "./importacao";

const base = { banca: "UFMS", ano: 2025 };

test("importar_prova: os dois campos da prova ao mesmo tempo → erro", () => {
  assert.throws(() => lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf", prova_base64: "JVBERi0=" }, "dono"), /prova_url ou prova_base64, não os dois/);
  assert.throws(() => lerPedidoImportacao({ ...base }, "dono"), /Mande o PDF da prova/);
  assert.throws(() => lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf", gabarito_url: "https://x.com/g.pdf", gabarito_base64: "JVBERi0=" }, "dono"), /gabarito_url ou gabarito_base64, não os dois/);
});

test("importar_prova: paginas_gabarito sem gabarito → erro", () => {
  assert.throws(() => lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf", paginas_gabarito: "1" }, "dono"), /paginas_gabarito sem o PDF do gabarito/);
});

test("importar_prova: professor com banco geral é recusado; escola é o padrão", () => {
  assert.throws(() => lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf", banco: "geral" }, "professor"), (e: Error) => e.message === "Você só pode importar no banco da sua escola.");
  assert.equal(lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf" }, "professor").escopo, "escola");
  assert.equal(lerPedidoImportacao({ ...base, prova_url: "https://x.com/a.pdf", banco: "geral" }, "dono").escopo, "geral");
});

test("importar_prova: pedido completo", () => {
  const p = lerPedidoImportacao({ ...base, caderno: " Azul ", prova_base64: "JVBERi0=", gabarito_url: "https://x.com/g.pdf", paginas_prova: "2-30", paginas_gabarito: "todas" }, "dono");
  assert.deepEqual(p, {
    escopo: "escola", banca: "UFMS", ano: 2025, caderno: "Azul",
    prova: { base64: "JVBERi0=" }, gabarito: { url: "https://x.com/g.pdf" }, paginasProva: "2-30", paginasGabarito: null,
  });
  assert.throws(() => lerPedidoImportacao({ ano: 2025, banca: "  ", prova_url: "https://x.com/a.pdf" }, "dono"), /Informe a banca/);
});

test("paginasDoTexto: 'todas' e vazio → null; texto fica", () => {
  assert.equal(paginasDoTexto("todas"), null);
  assert.equal(paginasDoTexto(" Todas "), null);
  assert.equal(paginasDoTexto(""), null);
  assert.equal(paginasDoTexto(undefined), null);
  assert.equal(paginasDoTexto("1-20, 23"), "1-20, 23");
});

test("selecionarPaginas: todas, texto e limite de 60", () => {
  assert.deepEqual(selecionarPaginas(null, 3, "prova"), [1, 2, 3]);
  assert.deepEqual(selecionarPaginas("2-3", 5, "prova"), [2, 3]);
  assert.throws(() => selecionarPaginas(null, 80, "prova"), /O PDF da prova tem 80 páginas; escolha no máximo 60/);
  assert.throws(() => selecionarPaginas("9", 5, "gabarito"), /PDF do gabarito: O PDF tem 5 páginas; a página 9 não existe/);
});

test("parametrosParaRegistro: sem base64 nem token do bot do Telegram", () => {
  const p = parametrosParaRegistro({ prova_url: "https://api.telegram.org/file/bot123:ABC-def/documents/x.pdf?x=1", gabarito_base64: "A".repeat(4000), banca: "UFMS" });
  assert.equal(p.prova_url, "https://api.telegram.org/file/bot***/documents/x.pdf");
  assert.equal(p.gabarito_base64, "(PDF em base64, 3 KB)");
  assert.equal(p.banca, "UFMS");
});

test("textoImportacaoCriada: faltam N páginas e manda chamar situacao_importacao", () => {
  const t = textoImportacaoCriada({ id: "abc", rotulo: "UFMS 2025", prontas: 5, total: 31, paginasProva: 29, custo: 1.5, link: "https://www.statusavalia.com.br/banco/importacoes/abc" });
  assert.match(t, /Importação abc criada \(UFMS 2025\)/);
  assert.match(t, /5 de 31 páginas desenhadas; faltam 26 páginas/);
  assert.match(t, /US\$ 1,50/);
  assert.match(t, /Chame situacao_importacao com importacao_id abc/);
  const pronta = textoImportacaoCriada({ id: "abc", rotulo: "UFMS 2025", prontas: 2, total: 2, paginasProva: 2, custo: 0.1, link: "l" });
  assert.match(pronta, /Todas as 2 páginas desenhadas/);
  assert.match(pronta, /situacao_importacao/);
});

const situacaoBase = { status: "enviando" as const, total: 0, lidas: 0, erros: [], avisos: [], custoEstimado: null, custoReal: null, questoes: 0, aConferir: 0 };

test("textoSituacao: enviando com páginas faltando", () => {
  const t = textoSituacao({ id: "abc", link: "L", situacao: situacaoBase, desenho: { prontas: 10, total: 31 } });
  assert.match(t, /Situação: enviando/);
  assert.match(t, /10 de 31 páginas desenhadas; faltam 21 páginas/);
  assert.match(t, /Chame situacao_importacao de novo/);
});

test("textoSituacao: lendo, revisão com questões e avisos, erro", () => {
  assert.match(textoSituacao({ id: "abc", link: "L", situacao: { ...situacaoBase, status: "lendo", total: 30, lidas: 4 }, leituraIniciada: true }), /Situação: lendo.[^]*começou a ler as 30 páginas/);
  const rev = textoSituacao({ id: "abc", link: "https://x/banco/importacoes/abc/revisar", situacao: { ...situacaoBase, status: "revisao", total: 30, lidas: 29, questoes: 45, aConferir: 40, erros: [{ pagina: 7, erro: "Resposta cortada." }], avisos: ["Página 3: sem resposta"], custoReal: 1.2 } });
  assert.match(rev, /Situação: em revisão/);
  assert.match(rev, /45 questões criadas \(40 a conferir\)/);
  assert.match(rev, /Página 7: Resposta cortada\./);
  assert.match(rev, /ler_de_novo/);
  assert.match(rev, /Aviso: Página 3: sem resposta/);
  assert.match(rev, /https:\/\/x\/banco\/importacoes\/abc\/revisar/);
  assert.match(textoSituacao({ id: "abc", link: "L", situacao: { ...situacaoBase, status: "erro", avisos: ["O PDF da prova está protegido por senha."] } }), /Situação: erro.[^]*protegido por senha/);
});

test("mensagem da tela para importação de outra escola", () => {
  assert.equal(ERRO_IMPORTACAO, "Importação não encontrada.");
});

test("dono sem escola, com mais de uma, recebe o pedido da escola", async () => {
  const escolas = [{ id: "e1", nome: "Status", slug: "status" }, { id: "e2", nome: "Harmonia", slug: "harmonia" }];
  const consulta = { select: () => consulta, order: async () => ({ data: escolas, error: null }) };
  const ctx: Ctx = { supabase: { from: () => consulta } as unknown as SupabaseClient, escopo: { tipo: "dono" } };
  await assert.rejects(escolaParaCriar(ctx), /Diga em qual escola: Status, Harmonia/);
  assert.equal((await escolaParaCriar(ctx, "harmonia")).id, "e2");
});
