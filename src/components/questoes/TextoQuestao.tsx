import { partesDoTexto, type Segmento } from "@/lib/questoes/markdown";

function Segmentos({ segs }: { segs: Segmento[] }) {
  return <>{segs.map((s, j) => (s.negrito ? <strong key={j}>{s.texto}</strong> : s.italico ? <em key={j}>{s.texto}</em> : <span key={j}>{s.texto}</span>))}</>;
}

/**
 * Markdown mínimo, sem HTML: tudo vira texto escapado pelo React. Linhas "| a | b |" viram tabela;
 * `semTabelas` as esconde (a questão já traz a tabela como figura recortada).
 */
export function TextoQuestao({ texto, semTabelas = false }: { texto: string; semTabelas?: boolean }) {
  const partes = partesDoTexto(texto, semTabelas);
  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap text-sm text-ink">
      {partes.map((p, i) =>
        p.tipo === "linha" ? (
          <p key={i} className="min-h-[1em]"><Segmentos segs={p.segmentos} /></p>
        ) : (
          <div key={i} className="my-1 overflow-x-auto">
            <table className="border-collapse text-xs">
              <tbody>
                {p.linhas.map((l, r) => (
                  <tr key={r} className={r === 0 ? "bg-surface-sunken font-semibold" : undefined}>
                    {l.map((c, k) => <td key={k} className="border border-line px-2 py-0.5 text-center">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
