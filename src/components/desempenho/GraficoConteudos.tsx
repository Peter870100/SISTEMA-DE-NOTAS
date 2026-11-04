import type { CSSProperties } from "react";
import Link from "next/link";
import { ehPrioritario } from "@/lib/desempenho/calculos";
import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";
import { chaveMateria, linkDetalhe } from "./links";
import css from "./PainelDesempenho.module.css";

/**
 * Barras horizontais da % de erro por conteúdo. Cada linha tem a altura do seu texto: nome e legenda
 * em HTML acima da barra, então nada é cortado no celular. Com `hrefBase`, o nome vira link para o
 * detalhe do conteúdo. Conteúdo em revisão prioritária ganha etiqueta e barra vermelhas; quando os de poucas
 * respostas vêm todos no fim, um separador os distingue.
 */
export function GraficoConteudos({ conteudos, hrefBase, aberto = null, minQuestoes }: { conteudos: ConteudoDesempenho[]; hrefBase?: string; aberto?: string | null; minQuestoes: number }) {
  const poucas = (c: ConteudoDesempenho) => c.questoes < minQuestoes;
  const corte = conteudos.findIndex(poucas);
  const separar = corte > 0 && conteudos.slice(corte).every(poucas);
  return (
    <ol className={css.graficoConteudos}>
      {conteudos.map((c, i) => {
        const nome = <strong>{c.nome}</strong>;
        const prioritario = ehPrioritario(c);
        return (
          <li key={c.chave} data-aberto={aberto === c.chave || undefined} data-prioritario={prioritario || undefined} data-poucas={poucas(c) || undefined}
            data-separar={(separar && i === corte) || undefined} style={{ "--i": Math.min(i, 15) } as CSSProperties}>
            <span className={css.nomeConteudo}>
              {hrefBase ? <Link href={linkDetalhe(hrefBase, chaveMateria(c), c.chave)} scroll={false}>{nome}</Link> : nome}
              {prioritario && <span className={css.prioritario}>revisão prioritária</span>}
              {poucas(c) && <span className={css.poucas}>poucas respostas</span>}
            </span>
            <span className={css.legendaConteudo}>{c.legenda}</span>
            <span className={css.trilho} role="img" aria-label={`${c.taxaErro}% de erro`}><span style={{ "--pct": `${c.taxaErro}%` } as CSSProperties} /></span>
          </li>
        );
      })}
    </ol>
  );
}
