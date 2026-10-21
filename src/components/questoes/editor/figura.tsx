"use client";

import { createContext, useContext } from "react";
import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { PanelLeft, PanelRight, Square, Trash2 } from "lucide-react";
import { LIMITE_LEGENDA } from "@/lib/questoes/conteudo";
import estilos from "../EditorConteudo.module.css";

export type ImagensEditor = Map<string, { url: string }>;
/** Quem monta o editor entrega as imagens por aqui; a visão da figura relê quando o mapa muda. */
export const ImagensContexto = createContext<ImagensEditor>(new Map());

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    figura: {
      inserirFigura: (imagemId: string) => ReturnType;
    };
  }
}

const POSICOES = [
  { valor: "esquerda", rotulo: "Figura à esquerda", Icone: PanelLeft },
  { valor: "centro", rotulo: "Figura no centro", Icone: Square },
  { valor: "direita", rotulo: "Figura à direita", Icone: PanelRight },
] as const;
const JUSTIFICA = { esquerda: "flex-start", centro: "center", direita: "flex-end" } as const;

function VisaoFigura({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const imagens = useContext(ImagensContexto);
  const { imagemId, alinhamento, legenda } = node.attrs as { imagemId: string; alinhamento: keyof typeof JUSTIFICA; legenda: string };
  const url = imagens.get(imagemId)?.url;
  return (
    <NodeViewWrapper className={`${estilos.figura} ${selected ? estilos.figuraSelecionada : ""}`} data-drag-handle>
      <div className={estilos.figuraImagem} style={{ justifyContent: JUSTIFICA[alinhamento] ?? "center" }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Figura da questão" draggable={false} />
        ) : (
          <span className={estilos.figuraSemImagem}>Imagem indisponível</span>
        )}
      </div>
      {selected && (
        <div className={estilos.figuraControles} contentEditable={false}>
          {POSICOES.map(({ valor, rotulo, Icone }) => (
            <button key={valor} type="button" className={estilos.botao} aria-label={rotulo} title={rotulo} aria-pressed={alinhamento === valor} onClick={() => updateAttributes({ alinhamento: valor })}>
              <Icone size={16} aria-hidden="true" />
            </button>
          ))}
          <input
            type="text"
            className={estilos.figuraFonte}
            aria-label="Fonte da imagem"
            placeholder="Fonte da imagem"
            maxLength={LIMITE_LEGENDA}
            value={legenda}
            onChange={(e) => updateAttributes({ legenda: e.target.value })}
          />
          <button type="button" className={`${estilos.botao} ${estilos.botaoPerigo}`} aria-label="Remover figura" title="Remover figura" onClick={() => deleteNode()}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {!selected && legenda && <p className={estilos.figuraLegenda}>{legenda}</p>}
    </NodeViewWrapper>
  );
}

/** Figura no texto: guarda só o id da imagem; a URL vem do mapa `imagens` do componente. */
export const Figura = Node.create({
  name: "figura",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      imagemId: { default: "", parseHTML: (el) => el.getAttribute("data-imagem-id") ?? "", renderHTML: (a) => ({ "data-imagem-id": a.imagemId }) },
      alinhamento: { default: "centro", parseHTML: (el) => el.getAttribute("data-alinhamento") ?? "centro", renderHTML: (a) => ({ "data-alinhamento": a.alinhamento }) },
      legenda: { default: "", parseHTML: (el) => el.getAttribute("data-legenda") ?? "", renderHTML: (a) => ({ "data-legenda": a.legenda }) },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-figura]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-figura": "" }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VisaoFigura);
  },
  addCommands() {
    return {
      inserirFigura:
        (imagemId) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { imagemId, alinhamento: "centro", legenda: "" } }),
    };
  },
});
