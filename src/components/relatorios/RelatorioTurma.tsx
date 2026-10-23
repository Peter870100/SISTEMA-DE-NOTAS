import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos as ui } from "@/components/ui/estilos";
import type { RelatorioTurma as Dados } from "@/lib/relatorios/tipos";
import { formatarNota, formatarPct } from "@/lib/relatorios/calculos";
import { BotaoImprimir } from "./BotaoImprimir";
import { GraficosTurma } from "./GraficosTurma";
import { TabelaAlunos } from "./TabelaAlunos";
import css from "./Relatorio.module.css";

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
      <p className={ui.rotulo}>{rotulo}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-brand">{valor}</p>
    </div>
  );
}

export function RelatorioTurma({ turmaId, dados }: { turmaId: string; dados: Dados }) {
  const { mediaAprovacao, mediaTurma, mediaTurmaBase } = dados;
  const rotuloMedia = mediaTurmaBase === "andamento" ? "Média da turma (em andamento)" : mediaTurmaBase === "encerrados" ? "Média da turma (encerrados)" : "Média da turma";
  // `simulados` vem em ordem de abertura: o último é o mais recente.
  const ult = dados.simulados.at(-1);
  const pctUltimo = ult && ult.total > 0 ? formatarPct((ult.fizeram / ult.total) * 100) : "—";

  return (
    <PageLayout
      crumb={`Relatório · ${dados.anoLetivo}`}
      titulo={dados.turmaNome}
      subtitulo="Relatório da turma"
      acoes={
        <div className={`${css.naoImprimir} flex flex-wrap gap-2`}>
          <Link href={`/turma/${turmaId}`} className={ui.botaoSecundario}><ArrowLeft size={15} />Voltar à turma</Link>
          <BotaoImprimir />
        </div>
      }
    >
      <div className={css.pagina}>
        <p className={`rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-ink shadow-card ${css.cartao}`}>{dados.frase}</p>

        <div className={css.numeros}>
          <Numero rotulo="Alunos" valor={String(dados.alunos.length)} />
          <Numero rotulo={rotuloMedia} valor={mediaTurma === null ? "—" : formatarNota(mediaTurma)} />
          <Numero rotulo="Abaixo da média" valor={String(dados.abaixoDaMedia.length)} />
          <Numero rotulo="Fez o último simulado" valor={pctUltimo} />
        </div>

        <GraficosTurma
          mediaPorBimestre={dados.mediaPorBimestre}
          distribuicao={dados.distribuicao}
          materias={dados.materias}
          mediaAprovacao={mediaAprovacao}
        />

        <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
          <h2 className="font-display text-base font-semibold text-ink">Alunos</h2>
          <TabelaAlunos turmaId={turmaId} alunos={dados.alunos} bimestres={dados.mediaPorBimestre.map((b) => b.bimestre)} mediaAprovacao={mediaAprovacao} />
        </section>

        <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
          <h2 className="font-display text-base font-semibold text-ink">Simulados: quem não fez</h2>
          {dados.simulados.length === 0 ? (
            <p className="py-4 text-sm text-ink">Nenhum simulado para esta turma ainda.</p>
          ) : (
            <div className={css.rolagem}>
              <table className={css.tabela}>
                <thead><tr><th>Simulado</th><th>Fizeram</th><th>Não fizeram</th></tr></thead>
                <tbody>
                  {dados.simulados.map((s) => (
                    <tr key={s.simuladoId}>
                      <td className="font-semibold text-ink">{s.titulo}</td>
                      <td className="font-mono tabular-nums text-ink">{s.fizeram}/{s.total}</td>
                      <td className="min-w-64 !whitespace-normal text-ink">{s.naoFizeram.length ? s.naoFizeram.join(", ") : "Todos fizeram"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
