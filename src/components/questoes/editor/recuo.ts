import { Extension } from "@tiptap/react";
import { RECUO_MAXIMO, mudarRecuo } from "@/lib/questoes/recuo";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    recuo: {
      /** Aumenta (+1) ou diminui (-1) o recuo do parágrafo do cursor, entre 0 e 3. */
      mudarRecuo: (passo: 1 | -1) => ReturnType;
    };
  }
}

const nivel = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(RECUO_MAXIMO, Math.max(0, Math.floor(v))) : 0);

/** Atributo `recuo` (0–3) nos parágrafos, mostrado como padding igual ao do renderizador do aluno (2rem por nível). */
export const Recuo = Extension.create({
  name: "recuo",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          recuo: {
            default: 0,
            parseHTML: (el) => nivel(Number(el.getAttribute("data-recuo"))),
            renderHTML: (attrs) => {
              const n = nivel(attrs.recuo);
              return n > 0 ? { "data-recuo": String(n), style: `padding-left: ${n * 2}rem` } : {};
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      mudarRecuo:
        (passo) =>
        ({ state, commands }) => {
          const atual = state.selection.$from.parent.attrs.recuo;
          return commands.updateAttributes("paragraph", { recuo: mudarRecuo(atual, passo) });
        },
    };
  },
});
