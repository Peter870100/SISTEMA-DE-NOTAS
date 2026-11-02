import type { CSSProperties } from "react";
import Link from "next/link";
import { REGRAS } from "@/lib/desempenho/regras";
import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";
import { chaveMateria, linkDetalhe } from "./links";
import css from "./PainelDesempenho.module.css";

/**
 * Barras horizontais da % de erro por conteúdo. Cada linha tem a altura do seu texto: nome e legenda
 * em HTML acima da barra, então nada é cortado no celular. Com `hrefBase`, o nome vira link para o
 * detalhe do conteúdo.
 */
export function GraficoConteudos({ conteudos, hrefBase, aberto = null }: { conteudos: ConteudoDesempenho[]; hrefBase?: string; aberto?: string | null }) {
  return (
    <ol className={css.graficoConteudos}>
      {conteudos.map((c, i) => {
        const nome = <strong>{c.nome}</strong>;
        return (
          <li key={c.chave} data-aberto={aberto === c.chave || undefined} style={{ "--i": Math.min(i, 15) } as CSSProperties}>
            <span className={css.nomeConteudo}>
              {hrefBase ? <Link href={linkDetalhe(hrefBase, chaveMateria(c), c.chave)} scroll={false}>{nome}</Link> : nome}
              {c.questoes < REGRAS.minQuestoesPrioridade && <span className={css.poucas}>poucas respostas</span>}
            </span>
            <span className={css.legendaConteudo}>{c.legenda}</span>
            <span className={css.trilho} role="img" aria-label={`${c.taxaErro}% de erro`}><span style={{ "--pct": `${c.taxaErro}%` } as CSSProperties} /></span>
          </li>
        );
      })}
    </ol>
  );
}
