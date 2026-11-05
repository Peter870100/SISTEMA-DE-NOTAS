import { Fragment } from "react";
import { markdownParaBlocos } from "@/lib/questoes/markdown";

/** Texto com **negrito**, *itálico* e quebras de linha; tudo passa pelo React como texto (nada de HTML). */
export function Texto({ texto }: { texto: string }) {
  const linhas = markdownParaBlocos(texto);
  return (
    <>
      {linhas.map((segs, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {segs.map((s, j) => (s.negrito ? <strong key={j}>{s.texto}</strong> : s.italico ? <em key={j}>{s.texto}</em> : <Fragment key={j}>{s.texto}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}
