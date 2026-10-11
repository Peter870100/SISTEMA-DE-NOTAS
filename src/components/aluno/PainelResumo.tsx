import type { LucideIcon } from "lucide-react";
import css from "./PainelResumo.module.css";

export type ItemResumo = { rotulo: string; valor: string; detalhe: string; Icone: LucideIcon };

/** Faixa de números do topo das páginas do aluno (simulados, cursos). */
export function PainelResumo({ itens }: { itens: ItemResumo[] }) {
  return (
    <dl className={css.painel} aria-label="Resumo">
      {itens.map(({ rotulo, valor, detalhe, Icone }) => (
        <div key={rotulo}>
          <span className={css.icone} aria-hidden="true"><Icone size={22} strokeWidth={2.2} /></span>
          <div><dt>{rotulo}</dt><dd>{valor}</dd><p>{detalhe}</p></div>
        </div>
      ))}
    </dl>
  );
}
