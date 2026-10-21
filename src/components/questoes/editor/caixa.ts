import { Node, mergeAttributes } from "@tiptap/react";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    caixa: {
      /** Põe os parágrafos selecionados numa caixa com borda, ou tira da caixa. */
      alternarCaixa: () => ReturnType;
    };
  }
}

/** Quadro com borda para "Texto I", citações etc. Só contém parágrafos. */
export const Caixa = Node.create({
  name: "caixa",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-caixa]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-caixa": "" }), 0];
  },
  addCommands() {
    return {
      alternarCaixa: () => ({ commands }) => commands.toggleWrap(this.name),
    };
  },
});
