import type { ResultadoAluno as Resultado } from "@/actions/simulados-aluno";
import type { QuestaoAluno } from "@/lib/simulados/servidor";
import { AREAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { estilos } from "@/components/ui/estilos";

const LETRAS = ["A", "B", "C", "D", "E"] as const;
const fmt = (iso: string, opcoes: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opcoes });

export function ResultadoAluno({ resultado, questoes }: { resultado: Resultado; questoes: QuestaoAluno[] }) {
  if (!resultado.liberado) {
    return (
      <p role="status" className={`${estilos.card} p-5 text-sm text-ink`}>
        Entregue!{" "}
        {resultado.liberaEm
          ? `A correção sai em ${fmt(resultado.liberaEm, { day: "2-digit", month: "2-digit" })} às ${fmt(resultado.liberaEm, { hour: "2-digit", minute: "2-digit" })}.`
          : "A correção sai quando o professor liberar."}
      </p>
    );
  }
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const areas = Object.entries(resultado.porArea) as [Area, { acertos: number; total: number }][];
  return (
    <div className="flex flex-col gap-4">
      <section className={`${estilos.card} p-5`} aria-label="Resultado">
        <p className="text-3xl font-semibold text-ink">{resultado.acertos}/{resultado.total} <span className="text-xl text-muted">· {resultado.porcentagem.toLocaleString("pt-BR")}%</span></p>
        {areas.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {areas.map(([area, v]) => {
              const pct = v.total ? Math.round((100 * v.acertos) / v.total) : 0;
              return (
                <li key={area} className="text-sm text-ink">
                  <div className="flex justify-between"><span>{AREAS[area] ?? area}</span><span>{v.acertos}/{v.total} · {pct}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-surface-sunken" role="progressbar" aria-label={AREAS[area] ?? area} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ol className="flex flex-col gap-2">
        {resultado.itens.map((it, i) => {
          const q = porId.get(it.questaoId);
          return (
            <li key={it.questaoId} className={`${estilos.card} p-3`}>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <strong>{i + 1}.</strong>
                {it.anulada
                  ? <span className="text-muted">anulada</span>
                  : <span className={it.correta ? "font-semibold text-ok" : "font-semibold text-danger"} aria-label={it.correta ? "Acertou" : "Errou"}>{it.correta ? "✓" : "✗"}</span>}
                <span className="text-muted">Sua resposta: {it.marcada ?? "em branco"} · Certa: {it.certa ?? "—"}</span>
              </div>
              {q && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Ver questão</summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <TextoQuestao texto={q.enunciado} />
                    {q.imagens.filter((im) => im.alvo === "enunciado").map((im) => <ImagemQuestao key={im.id} imagem={im} />)}
                    {q.comando && <p className="text-sm font-medium text-ink">{q.comando}</p>}
                    <ul className="flex flex-col gap-1">
                      {LETRAS.map((l) => (
                        <li key={l} className={`rounded-control border p-2 text-sm ${it.certa === l ? "border-ok bg-ok/10" : it.marcada === l ? "border-danger bg-danger/10" : "border-line"}`}>
                          <strong>{l})</strong> {q.alternativas.find((a) => a.letra === l)?.texto}
                          {q.imagens.filter((im) => im.alvo === l).map((im) => <ImagemQuestao key={im.id} imagem={im} />)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
