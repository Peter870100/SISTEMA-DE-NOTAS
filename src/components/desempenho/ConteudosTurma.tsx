import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";
import { GraficoConteudos } from "./GraficoConteudos";
import css from "@/components/relatorios/Relatorio.module.css";

/** Seção do relatório da turma: conteúdos com maior taxa de erro nas respostas entregues. */
export function ConteudosTurma({ conteudos, aviso }: { conteudos: ConteudoDesempenho[]; aviso?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao}`}>
      <h2 className="font-display text-base font-semibold text-ink">Conteúdos com mais erro na turma</h2>
      {aviso ? (
        <p className="py-4 text-sm text-ink">{aviso}</p>
      ) : conteudos.length === 0 ? (
        <p className="py-4 text-sm text-ink">Nenhum simulado entregue nesta turma ainda</p>
      ) : (
        <GraficoConteudos conteudos={conteudos} />
      )}
    </section>
  );
}
