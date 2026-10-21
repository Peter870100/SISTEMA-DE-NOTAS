import { test } from "node:test";
import assert from "node:assert/strict";
import { conteudoDeMarkdown, imagensDoConteudo, limparConteudo, textoDoConteudo, trocarIdsFiguras, type DocConteudo } from "./conteudo";

const p = (texto: string, extra: Record<string, unknown> = {}) => ({ type: "paragraph", ...extra, content: [{ type: "text", text: texto }] });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const enun = { modo: "enunciado" as const };

test("nó desconhecido some", () => {
  const r = limparConteudo(doc(p("a"), { type: "script", content: [{ type: "text", text: "x" }] }), enun);
  assert.deepEqual(r, doc(p("a")));
});

test("lixo vira null", () => {
  assert.equal(limparConteudo(null, enun), null);
  assert.equal(limparConteudo("x", enun), null);
  assert.equal(limparConteudo({ type: "paragraph" }, enun), null);
  assert.equal(limparConteudo(doc(), enun), null);
  assert.equal(limparConteudo(doc({ type: "paragraph" }), enun), null);
});

test("marca link some e atributos desconhecidos somem", () => {
  const r = limparConteudo(
    doc({ type: "paragraph", attrs: { onclick: "x" }, content: [{ type: "text", text: "a", marks: [{ type: "link", attrs: { href: "javascript:1" } }, { type: "bold", attrs: { z: 1 } }] }] }),
    enun,
  );
  assert.deepEqual(r, doc({ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }] }));
});

test("textAlign inválido some, válido fica", () => {
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { textAlign: "x" } })), enun), doc(p("a")));
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { textAlign: "center" } })), enun), doc(p("a", { attrs: { textAlign: "center" } })));
});

test("recuo é limitado a 0-3", () => {
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { recuo: 9 } })), enun), doc(p("a", { attrs: { recuo: 3 } })));
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { recuo: 1.7 } })), enun), doc(p("a", { attrs: { recuo: 1 } })));
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { recuo: -4 } })), enun), doc(p("a")));
  assert.deepEqual(limparConteudo(doc(p("a", { attrs: { recuo: "abc" } })), enun), doc(p("a")));
});

test("legenda é cortada em 300 e alinhamento padrão é centro", () => {
  const r = limparConteudo(doc({ type: "figura", attrs: { imagemId: "i1", legenda: "x".repeat(400), alinhamento: "foo" } }), enun)!;
  const f = r.content![0];
  assert.equal(f.attrs!.legenda, "x".repeat(300));
  assert.equal(f.attrs!.alinhamento, "centro");
});

test("figura fora de imagensValidas some", () => {
  const d = doc(p("a"), { type: "figura", attrs: { imagemId: "ok" } }, { type: "figura", attrs: { imagemId: "outra" } });
  const r = limparConteudo(d, { modo: "enunciado", imagensValidas: new Set(["ok"]) })!;
  assert.deepEqual(imagensDoConteudo(r), ["ok"]);
  assert.equal(limparConteudo(doc({ type: "figura", attrs: { imagemId: "x" } }), { modo: "enunciado", imagensValidas: new Set() }), null);
});

test("modo alternativa remove caixa, figura, linha e textAlign", () => {
  const d = doc(
    p("a", { attrs: { textAlign: "center", recuo: 2 } }),
    { type: "caixa", content: [p("b")] },
    { type: "figura", attrs: { imagemId: "i" } },
    { type: "horizontalRule" },
  );
  assert.deepEqual(limparConteudo(d, { modo: "alternativa" }), doc(p("a")));
});

test("caixa só aceita parágrafos", () => {
  const r = limparConteudo(doc({ type: "caixa", content: [p("b"), { type: "horizontalRule" }, { type: "caixa", content: [p("c")] }] }), enun);
  assert.deepEqual(r, doc({ type: "caixa", content: [p("b")] }));
});

test("limite de 60 000 caracteres", () => {
  const r = limparConteudo(doc(p("a".repeat(50000)), p("b".repeat(50000))), enun)!;
  assert.equal(textoDoConteudo(r).replace(/\n/g, "").length, 60000);
});

test("doc só com linha ou figura não é vazio", () => {
  assert.notEqual(limparConteudo(doc({ type: "horizontalRule" }), enun), null);
  assert.notEqual(limparConteudo(doc({ type: "figura", attrs: { imagemId: "i" } }), enun), null);
});

test("textoDoConteudo com caixa, figura e hardBreak", () => {
  const d: DocConteudo = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] },
      { type: "figura", attrs: { imagemId: "i", alinhamento: "centro", legenda: "fonte" } },
      { type: "horizontalRule" },
      { type: "caixa", content: [{ type: "paragraph", content: [{ type: "text", text: "c" }] }, { type: "paragraph", content: [{ type: "text", text: "d" }] }] },
    ],
  };
  assert.equal(textoDoConteudo(d), "a\nb\nc\nd");
  assert.equal(textoDoConteudo(null), "");
});

test("imagensDoConteudo na ordem, inclusive dentro da caixa", () => {
  const d = doc({ type: "figura", attrs: { imagemId: "1" } }, p("x"), { type: "figura", attrs: { imagemId: "2" } }) as DocConteudo;
  assert.deepEqual(imagensDoConteudo(d), ["1", "2"]);
  assert.deepEqual(imagensDoConteudo(null), []);
});

test("conteudoDeMarkdown converte linhas e marcas", () => {
  const r = conteudoDeMarkdown("a **b** *c*\nd");
  assert.deepEqual(r, {
    type: "doc",
    content: [
      { type: "paragraph", content: [
        { type: "text", text: "a " },
        { type: "text", text: "b", marks: [{ type: "bold" }] },
        { type: "text", text: " " },
        { type: "text", text: "c", marks: [{ type: "italic" }] },
      ] },
      { type: "paragraph", content: [{ type: "text", text: "d" }] },
    ],
  });
});

test("conteudoDeMarkdown: linha vazia e marcador solto", () => {
  const r = conteudoDeMarkdown("a\n\n**b");
  assert.equal(r.content!.length, 3);
  assert.equal(r.content![1].content, undefined);
  assert.equal(textoDoConteudo(r), "a\n\n**b");
});

test("ida e volta sem marcadores", () => {
  const t = "linha um\n\nlinha três\nfim";
  assert.equal(textoDoConteudo(conteudoDeMarkdown(t)), t);
  assert.equal(textoDoConteudo(conteudoDeMarkdown("x **y** *z*")), "x y z");
});

test("trocarIdsFiguras troca provisório pelo real e remove o que não foi enviado", () => {
  const fig = (id: string) => ({ type: "figura", attrs: { imagemId: id, alinhamento: "centro", legenda: "" } });
  const entrada = doc(p("a"), fig("tmp1"), fig("tmp2"), fig("real")) as DocConteudo;
  const r = trocarIdsFiguras(entrada, new Map([["tmp1", "id1"]]), new Set(["tmp1", "tmp2"]));
  assert.deepEqual(imagensDoConteudo(r), ["id1", "real"]);
  assert.deepEqual(imagensDoConteudo(entrada), ["tmp1", "tmp2", "real"]); // não altera a entrada
  assert.equal(trocarIdsFiguras(null, new Map(), new Set()), null);
});
