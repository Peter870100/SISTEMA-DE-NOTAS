"use client";

import { createContext, useContext } from "react";
import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { PanelLeft, PanelRight, Square, Trash2 } from "lucide-react";
import { LIMITE_LEGENDA } from "@/lib/questoes/conteudo";
import { faixaParaFigura, linhaVaziaAntesDeFigura } from "@/lib/questoes/figura-editor";
import { ImagemQuestao, type ImagemTela } from "../ImagemQuestao";
import estilos from "../EditorConteudo.module.css";

/** `tela` vem das imagens do servidor (permite mostrar o recorte); imagens só locais têm apenas a URL. */
export type ImagensEditor = Map<string, { url: string; tela?: ImagemTela }>;
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
  const imagem = imagens.get(imagemId);
  const url = imagem?.url;
  return (
    <NodeViewWrapper className={`${estilos.figura} ${selected ? estilos.figuraSelecionada : ""}`} data-drag-handle>
      <div className={estilos.figuraImagem} style={{ justifyContent: JUSTIFICA[alinhamento] ?? "center" }}>
        {url && imagem?.tela ? (
          <div style={{ width: "100%" }}><ImagemQuestao imagem={{ ...imagem.tela, alinhamento: alinhamento in JUSTIFICA ? alinhamento : "centro" }} /></div>
        ) : url ? (
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
        ({ state, commands }) =>
          commands.insertContentAt(faixaParaFigura(state), { type: this.name, attrs: { imagemId, alinhamento: "centro", legenda: "" } }),
    };
  },
  addKeyboardShortcuts() {
    // Linha vazia antes de uma figura (ex.: questões salvas antes da correção) sai com Backspace/Delete.
    const apagarLinhaVazia = () => {
      const faixa = linhaVaziaAntesDeFigura(this.editor.state, this.name);
      return faixa ? this.editor.commands.deleteRange(faixa) : false;
    };
    return { Backspace: apagarLinhaVazia, Delete: apagarLinhaVazia };
  },
});
