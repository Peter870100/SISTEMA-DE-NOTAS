import type { ConteudoPlano } from "@/lib/plano/tipos";
import css from "./PlanoEstudo.module.css";

/** Selo do conteúdo no plano: andamento das etapas ou "Revisado ✓" no concluído. */
export function SeloPlano({ c }: { c: ConteudoPlano }) {
  const concluido = c.situacao === "concluido";
  return (
    <span className={css.selo} data-concluido={concluido || undefined}>
      {concluido ? "Revisado ✓" : `No plano: ${c.feitas} de ${c.total} ${c.total === 1 ? "etapa" : "etapas"}`}
    </span>
  );
}
