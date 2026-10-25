import { test } from "node:test";
import assert from "node:assert/strict";
import { Schema, type Node as NoPM } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { faixaParaFigura, linhaVaziaAntesDeFigura } from "./figura-editor";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    figura: { group: "block", atom: true, attrs: { imagemId: { default: "" } } },
    text: { group: "inline" },
  },
});
const p = (t?: string) => schema.node("paragraph", null, t ? [schema.text(t)] : []);
const fig = () => schema.node("figura", { imagemId: "img" });

function estado(nos: NoPM[], cursor: number) {
  const s = EditorState.create({ doc: schema.node("doc", null, nos) });
  return s.apply(s.tr.setSelection(TextSelection.create(s.doc, cursor)));
}
function inserir(s: EditorState): string[] {
  const { from, to } = faixaParaFigura(s);
  return s.tr.replaceWith(from, to, fig()).doc.toJSON().content.map((n: { type: string; content?: { text: string }[] }) => n.type + (n.content ? `:${n.content[0].text}` : ""));
}

test("figura no começo do texto fica em primeiro, sem linha vazia antes", () => {
  assert.deepEqual(inserir(estado([p("Texto")], 1)), ["figura", "paragraph:Texto"]);
});

test("figura no começo da segunda linha entra entre as linhas", () => {
  assert.deepEqual(inserir(estado([p("Um"), p("Dois")], 5)), ["paragraph:Um", "figura", "paragraph:Dois"]);
});

test("figura numa linha vazia ocupa o lugar dela", () => {
  assert.deepEqual(inserir(estado([p("Um"), p()], 5)), ["paragraph:Um", "figura"]);
});

test("figura no meio do texto divide a linha, como antes", () => {
  assert.deepEqual(inserir(estado([p("Texto")], 3)), ["paragraph:Te", "figura", "paragraph:xto"]);
});

test("linha vazia antes de uma figura pode ser apagada", () => {
  const s = estado([p(), fig(), p("Texto")], 1);
  const faixa = linhaVaziaAntesDeFigura(s);
  assert.deepEqual(faixa, { from: 0, to: 2 });
  assert.equal(s.tr.delete(faixa!.from, faixa!.to).doc.firstChild?.type.name, "figura");
});

test("linha com texto, ou vazia sem figura depois, não é apagada", () => {
  assert.equal(linhaVaziaAntesDeFigura(estado([p("Oi"), fig()], 1)), null);
  assert.equal(linhaVaziaAntesDeFigura(estado([p(), p("Texto")], 1)), null);
});
