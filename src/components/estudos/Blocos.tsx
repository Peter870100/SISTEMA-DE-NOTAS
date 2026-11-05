import { blocosVisiveis, type Bloco } from "@/lib/estudos/blocos";
import type { ImagemTela } from "@/lib/estudos/dados";
import { Texto } from "./Texto";
import css from "./Blocos.module.css";

function Foto({ imagem }: { imagem: ImagemTela }) {
  const creditos = [imagem.legenda, imagem.credito ? `Crédito: ${imagem.credito}` : null, imagem.licenca ? `Licença: ${imagem.licenca}` : null].filter(Boolean);
  return (
    <figure className={css.figura}>
      {/* eslint-disable-next-line @next/next/no-img-element -- desenho em data URL ou foto já tratada no bucket. */}
      <img src={imagem.src} alt={imagem.alt} className={css.imagem} />
      {creditos.length > 0 && <figcaption>{creditos.join(" · ")}</figcaption>}
    </figure>
  );
}

function Um({ b, imagens }: { b: Bloco; imagens: Record<string, ImagemTela> }) {
  switch (b.tipo) {
    case "titulo":
      return <h3 className={css.titulo}>{b.texto}</h3>;
    case "paragrafo":
      return <p className={css.paragrafo}><Texto texto={b.texto} /></p>;
    case "lista":
      return <ul className={css.lista}>{b.itens.map((t, i) => <li key={i}><Texto texto={t} /></li>)}</ul>;
    case "exemplo":
      return (
        <div className={css.exemplo}>
          <p className={css.rotulo}>Exemplo</p>
          <p><Texto texto={b.enunciado} /></p>
          {b.conta && <span className={css.conta}><Texto texto={b.conta} /></span>}
          {b.conclusao && <p><Texto texto={b.conclusao} /></p>}
        </div>
      );
    case "pegadinhas":
      return (
        <div className={css.pegadinhas}>
          <p className={css.rotulo}>Pegadinhas comuns de prova</p>
          <ul>{b.itens.map((i, k) => <li key={k}><strong>{i.titulo}:</strong> <Texto texto={i.texto} /></li>)}</ul>
        </div>
      );
    case "trecho": {
      const foto = b.imagem_id ? imagens[b.imagem_id] : undefined;
      return (
        <div className={css.trecho} data-com-foto={foto ? "" : undefined}>
          {foto && <Foto imagem={foto} />}
          <div className={css.trechoTexto}>
            <blockquote><Texto texto={b.texto} /></blockquote>
            <p className={css.autor}>{b.autor}</p>
            {b.repare && <p className={css.repare}><strong>Repare:</strong> <Texto texto={b.repare} /></p>}
          </div>
        </div>
      );
    }
    case "cartoes":
      return (
        <div className={css.cartoes}>
          {b.itens.map((i, k) => (
            <div key={k} className={css.cartaoMini}>
              <strong>{i.titulo}</strong>
              {i.subtitulo && <small>{i.subtitulo}</small>}
              <p><Texto texto={i.texto} /></p>
            </div>
          ))}
        </div>
      );
    case "linha_tempo":
      return (
        <figure className={css.linhaTempo}>
          <p className={css.rotulo}>{b.titulo}</p>
          <ol style={{ gridTemplateColumns: `repeat(${b.itens.length}, minmax(0, 1fr))` }}>
            {b.itens.map((i, k) => (
              <li key={k} data-atual={i.destaque ? "" : undefined}><b>{i.ano}</b><span>{i.nome}</span></li>
            ))}
          </ol>
          {b.legenda && <figcaption>{b.legenda}</figcaption>}
        </figure>
      );
    case "tabela":
      return (
        <div className={css.tabela} tabIndex={0} role="region" aria-label="Tabela">
          <table>
            <tbody>
              {b.linhas.map((l, r) => (
                <tr key={r}>{l.map((c, k) => (r === 0 ? <th key={k} scope="col">{c}</th> : <td key={k}>{c}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "imagem": {
      const img = imagens[b.imagem_id];
      return img ? <Foto imagem={img} /> : null;
    }
  }
}

/** Explicação do estudo. Servidor ou cliente: só recebe dados simples. Blocos com imagem ausente não aparecem. */
export function Blocos({ blocos, imagens }: { blocos: Bloco[]; imagens: Record<string, ImagemTela> }) {
  const visiveis = blocosVisiveis(blocos, new Set(Object.keys(imagens)));
  return (
    <div className={css.blocos}>
      {visiveis.map((b, i) => <Um key={i} b={b} imagens={imagens} />)}
    </div>
  );
}
