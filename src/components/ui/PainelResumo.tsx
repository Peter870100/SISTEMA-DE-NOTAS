import type { LucideIcon } from "lucide-react";
import css from "./PainelResumo.module.css";

export type ItemResumo = { rotulo: string; valor: string; detalhe: string; Icone: LucideIcon };

/** Faixa de números do topo das páginas (aluno e professor). */
export function PainelResumo({ itens }: { itens: ItemResumo[] }) {
  return (
    <dl className={css.painel} aria-label="Resumo">
      {itens.map(({ rotulo, valor, detalhe, Icone }) => (
        <div key={rotulo} className="cartao-interativo">
          <span className={css.icone} data-icone aria-hidden="true"><Icone size={22} strokeWidth={2.2} /></span>
          <div><dt>{rotulo}</dt><dd>{valor}</dd><p>{detalhe}</p></div>
        </div>
      ))}
    </dl>
  );
}
