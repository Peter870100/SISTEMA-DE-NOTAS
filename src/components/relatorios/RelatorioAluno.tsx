import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos as ui } from "@/components/ui/estilos";
import type { AtividadeAluno, RelatorioAluno as Dados, LinhaSimuladoAluno, ResumoAulas } from "@/lib/relatorios/tipos";
import { formatarNota, formatarPct } from "@/lib/relatorios/calculos";
import {
  cartaoQuantoFalta,
  formatarDataCurta,
  formatarDuracao,
  pontosBimestres,
  pontosSimulados,
  ROTULO_SITUACAO,
  tomQuantoFalta,
  type TomQuantoFalta,
} from "@/lib/relatorios/apresentacao";
import { BotaoImprimir } from "./BotaoImprimir";
import { GraficosAluno } from "./GraficosAluno";
import css from "./Relatorio.module.css";

const TOM: Record<TomQuantoFalta, string> = {
  ok: "border-ok bg-ok/10",
  gold: "border-gold bg-gold/20",
  danger: "border-danger bg-danger/10",
  brand: "border-brand bg-brand/10",
};

const AVISO_SEM_CONTA = "Este aluno ainda não tem conta de login; simulados e aulas aparecem quando a conta for ligada.";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
      <h2 className="font-display text-base font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
      <p className={ui.rotulo}>{rotulo}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-brand">{valor}</p>
    </div>
  );
}

function TabelaSimulados({ linhas, vazio }: { linhas: LinhaSimuladoAluno[]; vazio: string }) {
  if (linhas.length === 0) return <p className="py-4 text-sm text-ink">{vazio}</p>;
  return (
    <div className={css.rolagem}>
      <table className={css.tabela}>
        <thead><tr><th>Título</th><th>Data</th><th>Situação</th><th>Nota</th><th>Tempo</th><th>Saídas</th></tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.simuladoId}>
              <td className="!whitespace-normal font-semibold text-ink">{l.titulo}</td>
              <td className="font-mono tabular-nums text-ink">{formatarDataCurta(l.abreEm)}</td>
              <td className="text-ink">{ROTULO_SITUACAO[l.situacao]}</td>
              <td className="font-mono tabular-nums text-ink">{l.nota10 === null ? "—" : formatarNota(l.nota10)}</td>
              <td className="font-mono tabular-nums text-ink">{formatarDuracao(l.tempoSeg)}</td>
              <td className="font-mono tabular-nums text-ink">{l.saidas === null ? "—" : l.saidas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaAtividades({ atividades }: { atividades: AtividadeAluno[] }) {
  if (atividades.length === 0) return <p className="py-4 text-sm text-ink">Nenhuma atividade lançada neste bimestre ainda.</p>;
  return (
    <div className={css.rolagem}>
      <table className={css.tabela}>
        <thead><tr><th>Atividade</th><th>Tipo</th><th>Nota / situação</th></tr></thead>
        <tbody>
          {atividades.map((a, i) => (
            <tr key={`${a.titulo}-${i}`}>
              <td className="!whitespace-normal font-semibold text-ink">{a.titulo}</td>
              <td className="text-ink">{a.tipo === "presenca" ? "Presença" : "Nota"}</td>
              <td className="font-mono tabular-nums text-ink">{a.nota10 !== null ? formatarNota(a.nota10) : a.status ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function textoAssistido(a: ResumoAulas["aulas"][number]): string {
  if (a.estado === "concluida") return "Concluída";
  if (a.estado === "nao_iniciada") return "Não começada";
  return a.pct > 0 ? formatarPct(a.pct) : "Começada";
}

export function RelatorioAluno({ turmaId, dados }: { turmaId: string; dados: Dados }) {
  const { mediaAprovacao } = dados;
  const semConta = !dados.temConta;
  const q = cartaoQuantoFalta(dados.quantoFalta, mediaAprovacao);
  const tom = tomQuantoFalta(dados.quantoFalta.situacao);
  const encerradas = dados.bimestres.filter((b) => b.encerrado && b.media !== null).map((b) => b.media as number);
  const mediaAtual = dados.quantoFalta.mediaAtual ?? (encerradas.length ? encerradas.reduce((a, b) => a + b, 0) / encerradas.length : null);
  const aulas = dados.aulas;
  const feitos = dados.simulados.filter((s) => s.situacao === "fez").length;

  return (
    <PageLayout
      crumb={`Relatório · ${dados.anoLetivo}`}
      titulo={dados.nome}
      subtitulo={`${dados.turmaNome} · Relatório do aluno`}
      acoes={
        <div className={`${css.naoImprimir} flex flex-wrap gap-2`}>
          <Link href={`/turma/${turmaId}/relatorio`} className={ui.botaoSecundario}><ArrowLeft size={15} />Relatório da turma</Link>
          <BotaoImprimir />
        </div>
      }
    >
      <div className={css.pagina}>
        {dados.historicoParcial && (
          <p role="alert" className={`flex items-start gap-2 rounded-card border border-warn bg-warn/10 p-3 text-sm text-ink ${css.cartao}`}>
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            Histórico parcial: há outro aluno com o mesmo nome sem vínculo de conta, então alguns bimestres podem não ter sido juntados.
          </p>
        )}

        <div className={`rounded-card border-2 p-5 shadow-card ${TOM[tom]} ${css.cartao}`}>
          <p className={ui.rotulo}>Quanto falta para a média {formatarNota(mediaAprovacao)}</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{q.titulo}</p>
          {q.destaque && <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-ink">{q.destaque}</p>}
          <p className="mt-1 text-sm leading-relaxed text-ink">{q.texto}</p>
        </div>

        <p className={`rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-ink shadow-card ${css.cartao}`}>{dados.frase}</p>

        <div className={css.numeros}>
          <Numero rotulo="Média atual" valor={mediaAtual === null ? "—" : formatarNota(mediaAtual)} />
          <Numero rotulo="Simulados feitos" valor={`${feitos}/${dados.simulados.length}`} />
          <Numero rotulo="Aulas concluídas" valor={aulas ? `${aulas.concluidas}/${aulas.total}` : "—"} />
          <Numero rotulo="Último acesso" valor={formatarDataCurta(dados.ultimoAcesso)} />
        </div>

        <GraficosAluno
          bimestres={pontosBimestres(dados.bimestres)}
          materias={dados.materias}
          simulados={pontosSimulados(dados.simulados)}
          mediaAprovacao={mediaAprovacao}
          semConta={semConta}
        />

        <Secao titulo={`Atividades do bimestre (${dados.atividadesBimestre})`}>
          <TabelaAtividades atividades={dados.atividades} />
        </Secao>

        <Secao titulo="Simulados">
          {semConta ? <p className="py-4 text-sm text-ink">{AVISO_SEM_CONTA}</p> : <TabelaSimulados linhas={dados.simulados} vazio="Nenhum simulado para esta turma ainda." />}
        </Secao>

        <Secao titulo="Treinos">
          {semConta ? <p className="py-4 text-sm text-ink">{AVISO_SEM_CONTA}</p> : <TabelaSimulados linhas={dados.treinos} vazio="Nenhum treino feito ainda." />}
        </Secao>

        <Secao titulo="Aulas">
          {semConta ? (
            <p className="py-4 text-sm text-ink">{AVISO_SEM_CONTA}</p>
          ) : !aulas || aulas.total === 0 ? (
            <p className="py-4 text-sm text-ink">Nenhum curso ligado a esta turma.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink">
                {aulas.concluidas} concluídas, {aulas.comecadas} começadas, {aulas.naoComecadas} não começadas.
              </p>
              <div className={css.rolagem}>
                <table className={css.tabela}>
                  <thead><tr><th>Aula</th><th>Assistido</th></tr></thead>
                  <tbody>
                    {aulas.aulas.map((a, i) => (
                      <tr key={`${a.titulo}-${i}`}>
                        <td className="!whitespace-normal font-semibold text-ink">{a.titulo}</td>
                        <td className="font-mono tabular-nums text-ink">{textoAssistido(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Secao>
      </div>
    </PageLayout>
  );
}
