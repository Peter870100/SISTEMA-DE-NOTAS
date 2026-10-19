import type { ReactNode } from "react";
import { imagensDoConteudo, type DocConteudo, type MarcaConteudo, type NoConteudo } from "@/lib/questoes/conteudo";
import { ImagemQuestao, type ImagemTela } from "./ImagemQuestao";
import { TextoQuestao } from "./TextoQuestao";
import type { Alinhamento } from "@/lib/types";
import css from "./ConteudoQuestao.module.css";

// Só renderiza o que está na lista fechada; tipos, marcas e atributos desconhecidos são ignorados.
const ALINHAMENTOS_TEXTO: Record<string, string> = { left: css.esquerda, center: css.centro, right: css.direita, justify: css.justificado };
const RECUOS = [undefined, css.recuo1, css.recuo2, css.recuo3];
const ALINHAMENTOS_FIGURA = ["esquerda", "centro", "direita"];
const TEXTO_FIGURA: Record<string, string> = { esquerda: css.esquerda, centro: css.centro, direita: css.direita };

function comMarcas(texto: ReactNode, marks: MarcaConteudo[] | undefined): ReactNode {
  let no = texto;
  for (const m of marks ?? []) {
    if (m.type === "bold") no = <strong>{no}</strong>;
    else if (m.type === "italic") no = <em>{no}</em>;
    else if (m.type === "underline") no = <u>{no}</u>;
    else if (m.type === "subscript") no = <sub>{no}</sub>;
    else if (m.type === "superscript") no = <sup>{no}</sup>;
  }
  return no;
}

function inline(nos: NoConteudo[] | undefined): ReactNode[] {
  const saida: ReactNode[] = [];
  (nos ?? []).forEach((n, i) => {
    if (n.type === "hardBreak") saida.push(<br key={i} />);
    else if (n.type === "text" && typeof n.text === "string") saida.push(<span key={i}>{comMarcas(n.text, Array.isArray(n.marks) ? n.marks : undefined)}</span>);
  });
  return saida;
}

function Paragrafo({ no }: { no: NoConteudo }) {
  const ta = typeof no.attrs?.textAlign === "string" ? ALINHAMENTOS_TEXTO[no.attrs.textAlign] : undefined;
  const r = no.attrs?.recuo;
  const recuo = typeof r === "number" && Number.isFinite(r) ? RECUOS[Math.min(3, Math.max(0, Math.floor(r)))] : undefined;
  return <p className={[css.paragrafo, ta, recuo].filter(Boolean).join(" ")}>{inline(no.content)}</p>;
}

export function ConteudoQuestao({
  doc, textoAntigo, imagens, classeTexto, classeFigura, aviso,
}: {
  doc: DocConteudo | null;
  textoAntigo: string;
  imagens: ImagemTela[];
  /** Classe do contêiner do texto (cada tela tem o seu). */
  classeTexto?: string;
  /** Classe de cada figura do enunciado. */
  classeFigura?: string;
  /** Aviso mostrado depois do texto e antes das figuras soltas (ex.: figura faltando). */
  aviso?: ReactNode;
}) {
  const doEnunciado = imagens.filter((i) => i.alvo === "enunciado");
  const figura = (i: ImagemTela) => (classeFigura ? <div key={i.id} className={classeFigura}><ImagemQuestao imagem={i} /></div> : <ImagemQuestao key={i.id} imagem={i} />);

  if (!doc || !Array.isArray(doc.content)) {
    return (
      <>
        <div className={classeTexto}><TextoQuestao texto={textoAntigo} /></div>
        {aviso}
        {doEnunciado.map(figura)}
      </>
    );
  }

  function Figura({ no }: { no: NoConteudo }) {
    const id = no.attrs?.imagemId;
    const img = typeof id === "string" ? doEnunciado.find((i) => i.id === id) ?? imagens.find((i) => i.id === id) : undefined;
    if (!img) return null;
    const al = typeof no.attrs?.alinhamento === "string" && ALINHAMENTOS_FIGURA.includes(no.attrs.alinhamento) ? (no.attrs.alinhamento as Alinhamento) : img.alinhamento;
    const legenda = typeof no.attrs?.legenda === "string" ? no.attrs.legenda.trim() : "";
    const corpo = (
      <figure className={css.figura} style={{ margin: 0 }}>
        <ImagemQuestao imagem={{ ...img, alinhamento: al }} />
        {legenda && <figcaption className={`${css.legenda} ${TEXTO_FIGURA[al] ?? ""}`}>{legenda}</figcaption>}
      </figure>
    );
    return classeFigura ? <div className={classeFigura}>{corpo}</div> : corpo;
  }

  const usadas = new Set(imagensDoConteudo(doc));
  return (
    <>
      <div className={classeTexto}>
        <div className={css.documento}>
          {doc.content.map((n, i) => {
            if (n.type === "paragraph") return <Paragrafo key={i} no={n} />;
            if (n.type === "horizontalRule") return <hr key={i} className={css.linha} />;
            if (n.type === "caixa") return <div key={i} className={css.caixa}>{(n.content ?? []).filter((p) => p.type === "paragraph").map((p, j) => <Paragrafo key={j} no={p} />)}</div>;
            if (n.type === "figura") return <Figura key={i} no={n} />;
            return null;
          })}
        </div>
      </div>
      {aviso}
      {doEnunciado.filter((i) => !usadas.has(i.id)).map(figura)}
    </>
  );
}

/**
 * Alternativa: só marcas de caractere (negrito, itálico, sublinhado, sub/sobrescrito) e quebra de linha.
 * Sem documento mostra o texto antigo: com `markdown` como TextoQuestao (prova), senão texto puro em linha (como as outras telas faziam).
 */
export function TextoAlternativa({ doc, texto, markdown = false }: { doc: DocConteudo | null | undefined; texto: string; markdown?: boolean }) {
  if (!doc || !Array.isArray(doc.content)) return markdown ? <TextoQuestao texto={texto} /> : <>{texto}</>;
  const paragrafos = doc.content.filter((n) => n.type === "paragraph");
  return (
    <span className={`${css.alternativa} ${markdown ? css.alternativaBloco : ""}`}>
      {paragrafos.map((p, i) => <span key={i}>{i > 0 && <br />}{inline(p.content)}</span>)}
    </span>
  );
}
