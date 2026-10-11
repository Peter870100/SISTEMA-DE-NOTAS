import type { CSSProperties } from "react";
import type { ResultadoAluno as Resultado } from "@/actions/simulados-aluno";
import type { QuestaoAluno } from "@/lib/simulados/servidor";
import { AREAS } from "@/lib/questoes/materias";
import { formatarDuracao } from "@/lib/simulados/regras";
import type { Area } from "@/lib/types";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
import { estilos } from "@/components/ui/estilos";

import css from "./ResultadoAluno.module.css";

const LETRAS = ["A", "B", "C", "D", "E"] as const;
const fmt = (iso: string, opcoes: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opcoes });
const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function ResultadoAluno({ resultado, questoes }: { resultado: Resultado; questoes: QuestaoAluno[] }) {
  if (!resultado.liberado) {
    return (
      <p role="status" className={`${estilos.card} p-5 text-sm text-ink`}>
        Entregue!{" "}
        {resultado.tempoSeg != null && <>Você levou <strong>{formatarDuracao(resultado.tempoSeg)}</strong>. </>}
        {resultado.liberaEm
          ? `A correção sai em ${fmt(resultado.liberaEm, { day: "2-digit", month: "2-digit" })} às ${fmt(resultado.liberaEm, { hour: "2-digit", minute: "2-digit" })}.`
          : "A correção sai quando o professor liberar."}
      </p>
    );
  }
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const areas = Object.entries(resultado.porArea) as [Area, { acertos: number; total: number }][];
  const erros = resultado.itens.filter((it) => !it.correta && !it.anulada).length;
  const certas = resultado.itens.filter((it) => it.correta && !it.anulada).length;
  const pct = Math.max(0, Math.min(100, resultado.porcentagem));

  return (
    <div className={css.resultado} data-resultado-aluno>
      <section className={`${css.resumo} cartao-interativo`} aria-label="Resultado">
        <div className={css.anel} style={vars({ "--pct": pct })} role="img" aria-label={`${resultado.porcentagem.toLocaleString("pt-BR")}% de acerto`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className={css.anelFundo} cx="60" cy="60" r="52" pathLength={100} />
            <circle className={css.anelValor} cx="60" cy="60" r="52" pathLength={100} />
          </svg>
          <div><strong>{resultado.porcentagem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong><span>de acerto</span></div>
        </div>
        <dl className={css.numeros}>
          <div className={css.numeroOk}><dt>Acertos</dt><dd>{resultado.acertos}<small>/{resultado.total}</small></dd></div>
          <div className={css.numeroErro}><dt>Erros</dt><dd>{erros}</dd></div>
          {resultado.tempoSeg != null && <div className={css.numeroTempo}><dt>Tempo total</dt><dd>{formatarDuracao(resultado.tempoSeg)}</dd></div>}
        </dl>
        {areas.length > 0 && (
          <ul className={css.areas}>
            {areas.map(([area, v], i) => {
              const p = v.total ? Math.round((100 * v.acertos) / v.total) : 0;
              return (
                <li key={area} style={vars({ "--i": i })}>
                  <div className={css.areaTopo}><span>{AREAS[area] ?? area}</span><span>{v.acertos}/{v.total} · <strong>{p}%</strong></span></div>
                  <div className={css.barra} role="progressbar" aria-label={AREAS[area] ?? area} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
                    <div style={vars({ "--pct": `${p}%` })} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={css.revisao}>
        <fieldset className={css.filtros}>
          <legend className="sr-only">Mostrar questões</legend>
          <label><input type="radio" name="filtro-resultado" value="todas" defaultChecked />Todas <span>{resultado.itens.length}</span></label>
          <label><input type="radio" name="filtro-resultado" value="erradas" className={css.fErradas} />Erradas <span>{erros}</span></label>
          <label><input type="radio" name="filtro-resultado" value="certas" className={css.fCertas} />Certas <span>{certas}</span></label>
        </fieldset>

        <ol className={css.lista}>
          {resultado.itens.map((it, i) => {
            const q = porId.get(it.questaoId);
            const estado = it.anulada ? "anulada" : it.correta ? "certa" : "errada";
            return (
              <li key={it.questaoId} className={`${css.item} cartao-interativo`} data-estado={estado} style={vars({ "--i": Math.min(i, 15) })}>
                <div className={css.linha}>
                  <span className={css.numero}>Q{String(i + 1).padStart(2, "0")}</span>
                  <span className={css.status}>{estado === "anulada" ? "Anulada" : estado === "certa" ? "✓ Acertou" : "✗ Errou"}</span>
                  <span className={css.respostas}>
                    <span>Sua resposta <b className={`${css.selo} ${!it.marcada ? css.seloVazio : it.anulada ? css.seloNeutro : it.correta ? css.seloOk : css.seloErro}`}>{it.marcada ?? "–"}</b></span>
                    <span aria-hidden="true" className={css.seta}>→</span>
                    <span>Certa <b className={`${css.selo} ${css.seloOk}`}>{it.certa ?? "–"}</b></span>
                  </span>
                  {it.tempoSeg != null && (
                    <span className={css.tempo} aria-label={`Tempo na questão: ${formatarDuracao(it.tempoSeg)}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5M19 6l1.5-1.5" /></svg>
                      <span aria-hidden="true"><strong>{formatarDuracao(it.tempoSeg)}</strong><small>tempo</small></span>
                    </span>
                  )}
                </div>
                {q && (
                  <details className={css.detalhes}>
                    <summary>Ver questão</summary>
                    <div className={css.corpo}>
                      <TextoQuestao texto={q.enunciado} />
                      {q.imagens.filter((im) => im.alvo === "enunciado").map((im) => <ImagemQuestao key={im.id} imagem={im} />)}
                      {q.comando && <p className={css.comando}>{q.comando}</p>}
                      <ul className={css.alternativas}>
                        {LETRAS.map((l) => {
                          const tipo = it.certa === l ? css.altCerta : it.marcada === l ? css.altErrada : "";
                          return (
                            <li key={l} className={`${css.alternativa} ${tipo}`}>
                              <b className={css.letra}>{l}</b>
                              <div className="min-w-0 flex-1">
                                {q.alternativas.find((a) => a.letra === l)?.texto}
                                {q.imagens.filter((im) => im.alvo === l).map((im) => <ImagemQuestao key={im.id} imagem={im} />)}
                              </div>
                              {it.certa === l && <span className={css.marca}>✓ Correta</span>}
                              {it.certa !== l && it.marcada === l && <span className={css.marca}>✗ Sua resposta</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
        <p className={css.vazio}>Nenhuma questão neste filtro.</p>
      </div>
    </div>
  );
}
