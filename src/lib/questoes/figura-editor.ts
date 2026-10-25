// Onde a figura entra no editor do enunciado (funções puras sobre o estado do ProseMirror).
import type { EditorState } from "@tiptap/pm/state";

export type Faixa = { from: number; to: number };

/**
 * Faixa onde inserir uma figura no cursor. Sem isto, inserir com o cursor no começo de uma linha
 * divide a linha e deixa um parágrafo vazio antes da figura — e a figura nunca fica em primeiro.
 * Linha vazia: a figura ocupa o lugar dela. Começo de linha com texto: a figura entra antes da linha.
 */
export function faixaParaFigura(state: EditorState): Faixa {
  const { from, to, empty, $from } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.depth === 0) return { from, to };
  if ($from.parent.content.size === 0) return { from: $from.before(), to: $from.after() };
  if ($from.parentOffset === 0) return { from: $from.before(), to: $from.before() };
  return { from, to };
}

/** Linha vazia logo antes de uma figura (com o cursor nela): a faixa para apagá-la com Backspace/Delete. */
export function linhaVaziaAntesDeFigura(state: EditorState, nomeFigura = "figura"): Faixa | null {
  const { empty, $from } = state.selection;
  if (!empty || $from.depth === 0 || !$from.parent.isTextblock || $from.parent.content.size > 0) return null;
  const pai = $from.node($from.depth - 1);
  const seguinte = pai.maybeChild($from.index($from.depth - 1) + 1);
  if (seguinte?.type.name !== nomeFigura) return null;
  return { from: $from.before(), to: $from.after() };
}
