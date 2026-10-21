"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ImagePlus, IndentDecrease, IndentIncrease, Italic,
  Minus, SquareDashed, Subscript as IconeSub, Superscript as IconeSup, Underline as IconeSublinhado,
} from "lucide-react";
import type { DocConteudo } from "@/lib/questoes/conteudo";
import { colagemEhImagem } from "@/lib/questoes/colar";
import { EntradaImagem, type EntradaImagemRef } from "./EntradaImagem";
import { Caixa } from "./editor/caixa";
import { Figura, ImagensContexto, type ImagensEditor } from "./editor/figura";
import { Recuo } from "./editor/recuo";
import estilos from "./EditorConteudo.module.css";

type Props = {
  modo: "enunciado" | "alternativa";
  /** Documento inicial. Só é lido na montagem; para trocar de questão, remonte com `key`. */
  valor: DocConteudo | null;
  aoMudar: (doc: DocConteudo) => void;
  imagens: ImagensEditor;
  /** Envia/guarda a imagem e devolve o id usado no nó da figura (pode ser provisório). */
  aoInserirImagem?: (arquivo: File) => Promise<string>;
  rotulo: string;
};

// Só o que a lista fechada de `limparConteudo` aceita fica ligado.
function extensoes(enunciado: boolean) {
  return [
    StarterKit.configure({
      heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false,
      blockquote: false, code: false, codeBlock: false, strike: false, link: false,
      ...(enunciado ? {} : { horizontalRule: false }),
    }),
    Subscript,
    Superscript,
    ...(enunciado ? [TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }), Recuo, Caixa, Figura] : []),
  ];
}

function Botao({ rotulo, ativo, desabilitado, aoClicar, children }: { rotulo: string; ativo?: boolean; desabilitado?: boolean; aoClicar: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={estilos.botao}
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      // mousedown não tira o foco do texto, então a seleção continua valendo.
      onMouseDown={(e) => e.preventDefault()}
      onClick={aoClicar}
    >
      {children}
    </button>
  );
}

function Barra({ editor, enunciado, figuraAberta, alternarFigura, podeFigura }: { editor: Editor; enunciado: boolean; figuraAberta: boolean; alternarFigura: () => void; podeFigura: boolean }) {
  const c = () => editor.chain().focus();
  const alinha = (valor: string) => (editor.isActive({ textAlign: valor }) ? c().unsetTextAlign().run() : c().setTextAlign(valor).run());
  return (
    <div className={estilos.barra} role="toolbar" aria-label="Formatação do texto">
      <Botao rotulo="Negrito (Ctrl+B)" ativo={editor.isActive("bold")} aoClicar={() => c().toggleBold().run()}><Bold size={16} aria-hidden="true" /></Botao>
      <Botao rotulo="Itálico (Ctrl+I)" ativo={editor.isActive("italic")} aoClicar={() => c().toggleItalic().run()}><Italic size={16} aria-hidden="true" /></Botao>
      <Botao rotulo="Sublinhado (Ctrl+U)" ativo={editor.isActive("underline")} aoClicar={() => c().toggleUnderline().run()}><IconeSublinhado size={16} aria-hidden="true" /></Botao>
      <Botao rotulo="Subscrito (x₂)" ativo={editor.isActive("subscript")} aoClicar={() => c().toggleSubscript().run()}><IconeSub size={16} aria-hidden="true" /></Botao>
      <Botao rotulo="Sobrescrito (x²)" ativo={editor.isActive("superscript")} aoClicar={() => c().toggleSuperscript().run()}><IconeSup size={16} aria-hidden="true" /></Botao>
      {enunciado && (
        <>
          <span className={estilos.separador} aria-hidden="true" />
          <Botao rotulo="Alinhar à esquerda" ativo={editor.isActive({ textAlign: "left" })} aoClicar={() => alinha("left")}><AlignLeft size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Centralizar" ativo={editor.isActive({ textAlign: "center" })} aoClicar={() => alinha("center")}><AlignCenter size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Alinhar à direita" ativo={editor.isActive({ textAlign: "right" })} aoClicar={() => alinha("right")}><AlignRight size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Justificar" ativo={editor.isActive({ textAlign: "justify" })} aoClicar={() => alinha("justify")}><AlignJustify size={16} aria-hidden="true" /></Botao>
          <span className={estilos.separador} aria-hidden="true" />
          <Botao rotulo="Diminuir recuo" aoClicar={() => c().mudarRecuo(-1).run()}><IndentDecrease size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Aumentar recuo" aoClicar={() => c().mudarRecuo(1).run()}><IndentIncrease size={16} aria-hidden="true" /></Botao>
          <span className={estilos.separador} aria-hidden="true" />
          <Botao rotulo="Linha horizontal" aoClicar={() => c().setHorizontalRule().run()}><Minus size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Caixa de texto" ativo={editor.isActive("caixa")} aoClicar={() => c().alternarCaixa().run()}><SquareDashed size={16} aria-hidden="true" /></Botao>
          <Botao rotulo="Inserir figura" ativo={figuraAberta} desabilitado={!podeFigura} aoClicar={alternarFigura}><ImagePlus size={16} aria-hidden="true" /></Botao>
        </>
      )}
    </div>
  );
}

function arquivoDeImagem(e: ClipboardEvent): File | null {
  const dados = e.clipboardData;
  if (!dados) return null;
  const item = Array.from(dados.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const arquivo = item?.getAsFile() ?? null;
  return colagemEhImagem({ temArquivoImagem: !!arquivo, texto: dados.getData("text/plain"), html: dados.getData("text/html") }) ? arquivo : null;
}

export function EditorConteudo({ modo, valor, aoMudar, imagens, aoInserirImagem, rotulo }: Props) {
  const enunciado = modo === "enunciado";
  const podeFigura = enunciado && !!aoInserirImagem;
  const [figuraAberta, setFiguraAberta] = useState(false);
  const pendente = useRef<File | null>(null);
  const entrada = useRef<EntradaImagemRef | null>(null);

  // Refs para o editor (criado uma vez) enxergar sempre as props mais novas.
  const aoMudarRef = useRef(aoMudar);
  const podeFiguraRef = useRef(podeFigura);
  useEffect(() => { aoMudarRef.current = aoMudar; podeFiguraRef.current = podeFigura; });

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: extensoes(enunciado),
    content: valor ?? "",
    editorProps: {
      attributes: { "aria-label": rotulo, "aria-multiline": "true", role: "textbox", class: enunciado ? estilos.areaEnunciado : estilos.areaAlternativa },
      handlePaste: (_view, evento) => {
        if (!podeFiguraRef.current) return false;
        const arquivo = arquivoDeImagem(evento);
        if (!arquivo) return false; // texto: colar normal
        evento.preventDefault();
        if (entrada.current) entrada.current.receber(arquivo);
        else { pendente.current = arquivo; setFiguraAberta(true); }
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => aoMudarRef.current(ed.getJSON() as DocConteudo),
  });

  // O painel monta depois do Ctrl+V: a imagem colada espera aqui até a entrada existir.
  function receberPendente(r: EntradaImagemRef | null) {
    entrada.current = r;
    if (r && pendente.current) {
      r.receber(pendente.current);
      pendente.current = null;
    }
  }

  async function escolheu(arquivo: File) {
    if (!aoInserirImagem || !editor) return;
    const id = await aoInserirImagem(arquivo);
    editor.chain().focus().inserirFigura(id).run();
    setFiguraAberta(false);
  }

  if (!editor) return <div className={estilos.editor} aria-busy="true" />;
  return (
    <div className={estilos.editor}>
      <Barra editor={editor} enunciado={enunciado} figuraAberta={figuraAberta} alternarFigura={() => setFiguraAberta((v) => !v)} podeFigura={podeFigura} />
      {figuraAberta && podeFigura && (
        <div className={estilos.painelFigura}>
          <EntradaImagem ref={receberPendente} rotulo="Inserir figura no cursor" aoEscolher={escolheu} />
        </div>
      )}
      <ImagensContexto value={imagens}><EditorContent editor={editor} /></ImagensContexto>
    </div>
  );
}
