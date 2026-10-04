import { markdownParaBlocos } from "@/lib/questoes/markdown";

/** Markdown mínimo, sem HTML: tudo vira texto escapado pelo React. */
export function TextoQuestao({ texto }: { texto: string }) {
  const blocos = markdownParaBlocos(texto);
  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap text-sm text-ink">
      {blocos.map((segs, i) => (
        <p key={i} className="min-h-[1em]">
          {segs.map((s, j) => (s.negrito ? <strong key={j}>{s.texto}</strong> : s.italico ? <em key={j}>{s.texto}</em> : <span key={j}>{s.texto}</span>))}
        </p>
      ))}
    </div>
  );
}
