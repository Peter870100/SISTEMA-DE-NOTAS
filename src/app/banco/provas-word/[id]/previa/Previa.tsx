"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LoaderCircle, Printer } from "lucide-react";
import { itensGabarito, itensProva, type ItemFolha } from "@/lib/folha/estrutura";
import { paginar, type BlocoMedido, type PaginaPrevia } from "@/lib/folha/paginar";
import type { DadosPrevia, FiguraTela } from "@/lib/folha/previa";
import { MenuBaixar } from "../../MenuBaixar";
import { Bloco, Cabecalho, Rodape, TopoSeguintes, VARIAVEIS_FOLHA, type Qual } from "./Folha";
import css from "./Previa.module.css";

/** Largura de uma folha A4 em px CSS (210 mm a 96 dpi). */
const LARGURA_FOLHA_PX = (210 * 96) / 25.4;
/** Folga por coluna (px) para diferenças pequenas entre a tela e a impressão. */
const FOLGA_COLUNA = 3;

type Resultado = { qual: Qual; paginas: PaginaPrevia[]; extras: Record<number, number> };

const nada = () => () => {};
function useMontado(): boolean {
  return useSyncExternalStore(nada, () => true, () => false);
}

function assinarLargura(avisar: () => void) {
  window.addEventListener("resize", avisar);
  return () => window.removeEventListener("resize", avisar);
}
function useLarguraJanela(): number {
  return useSyncExternalStore(assinarLargura, () => window.innerWidth, () => 1280);
}

/** Espera as fontes e todas as imagens dentro de `raiz` (imagem com erro não trava). */
async function esperarCarregar(raiz: HTMLElement): Promise<void> {
  await document.fonts.ready;
  await Promise.all([...raiz.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
}

/** Abre a janela de impressão depois que as folhas estiverem desenhadas e as imagens prontas. */
function imprimirQuandoPronto(paginas: RefObject<HTMLDivElement | null>) {
  window.setTimeout(async () => {
    if (paginas.current) await esperarCarregar(paginas.current);
    requestAnimationFrame(() => window.print());
  }, 250);
}

const grudaNoProximo = (item: ItemFolha<FiguraTela>) => item.tipo === "faixa" || item.tipo === "titulo";

/** Pré-visualização da prova (ou do gabarito) em folhas A4, com barra para imprimir e baixar. */
export function Previa({
  dados,
  provaId,
  nomeBase,
  qual: qualInicial,
  imprimir,
}: {
  dados: DadosPrevia;
  provaId: string;
  nomeBase: string;
  qual: Qual;
  imprimir: boolean;
}) {
  const montado = useMontado();
  const largura = useLarguraJanela();
  const [qual, setQual] = useState<Qual>(qualInicial);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [avisoPdf, setAvisoPdf] = useState(false);
  const medicao = useRef<HTMLDivElement>(null);
  const paginasRef = useRef<HTMLDivElement>(null);
  const impressaoPedida = useRef(false);

  const itens = useMemo(
    () => (qual === "prova" ? itensProva(dados.questoes, dados.avisoFinal) : itensGabarito(dados.questoes, dados.avisoFinal)),
    [dados, qual],
  );
  const pronto = resultado?.qual === qual;

  // Mede cada bloco na largura da coluna e distribui nas páginas (de novo a cada troca Prova/Gabarito).
  useEffect(() => {
    if (pronto || !montado) return;
    const raiz = medicao.current;
    if (!raiz) return;
    let vivo = true;
    (async () => {
      await esperarCarregar(raiz);
      if (!vivo) return;
      const blocos: BlocoMedido[] = [];
      const extras: Record<number, number> = {};
      raiz.querySelectorAll<HTMLElement>("[data-bloco]").forEach((el, i) => {
        const altura = el.getBoundingClientRect().height;
        blocos.push({ altura, grudaNoProximo: grudaNoProximo(itens[i]) });
        const img = el.querySelector("img[data-figura]");
        if (img) extras[i] = altura - img.getBoundingClientRect().height;
      });
      const altura = (sel: string) => (raiz.querySelector(sel)?.getBoundingClientRect().height ?? 0) - FOLGA_COLUNA;
      const paginas = paginar(blocos, altura("[data-colunas-primeira]"), altura("[data-colunas-demais]"));
      setResultado({ qual, paginas, extras });
      if (imprimir && !impressaoPedida.current) {
        impressaoPedida.current = true;
        setAvisoPdf(true);
        imprimirQuandoPronto(paginasRef);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [itens, qual, pronto, montado, imprimir]);

  // Durante a impressão o título da aba vira o nome sugerido do PDF ao salvar.
  useEffect(() => {
    let anterior = document.title;
    const antes = () => {
      anterior = document.title;
      document.title = qual === "gabarito" ? `${nomeBase}-gabarito` : nomeBase;
    };
    const depois = () => {
      document.title = anterior;
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, [qual, nomeBase]);

  function trocar(q: Qual) {
    if (q === qual) return;
    setQual(q);
    const url = new URL(window.location.href);
    url.searchParams.set("qual", q);
    url.searchParams.delete("imprimir");
    window.history.replaceState(null, "", url);
  }

  function pdf() {
    setAvisoPdf(true);
    imprimirQuandoPronto(paginasRef);
  }

  if (!montado) return null;

  const escala = Math.min(1, Math.max(0.2, (largura - 32) / LARGURA_FOLHA_PX));
  const bolinhas = dados.bolinhas;

  const folha = (n: number, total: number, conteudo: ReactNode, atributosColunas: Record<string, string> = {}) => (
    <section className={css.folha} aria-label={`Página ${n + 1} de ${total}`}>
      {n > 0 && <TopoSeguintes titulo={dados.titulo} />}
      <div className={css.corpo}>
        {n === 0 && <Cabecalho dados={dados} qual={qual} />}
        <div className={css.colunas} {...atributosColunas}>{conteudo}</div>
      </div>
      <Rodape titulo={dados.titulo} qual={qual} numero={n + 1} />
    </section>
  );

  return createPortal(
    <div data-previa="" className={css.raiz} style={VARIAVEIS_FOLHA}>
      <style>{`@media print {
  @page { size: A4; margin: 0; }
  html, body { display: block !important; height: auto !important; overflow: visible !important; background: #fff !important; }
  body > :not([data-previa]) { display: none !important; }
}`}</style>

      <div className={css.barra} role="toolbar" aria-label="Ações da pré-visualização">
        <Link href="/banco/provas-word" className={css.botaoBarra}>← Voltar</Link>
        <span className={css.barraTitulo}>{dados.titulo}</span>
        <div className={css.alternar} role="group" aria-label="Folha">
          {(["prova", "gabarito"] as const).map((q) => (
            <button key={q} type="button" aria-pressed={qual === q} disabled={!pronto} onClick={() => trocar(q)}>
              {q === "prova" ? "Prova" : "Gabarito"}
            </button>
          ))}
        </div>
        {!pronto && (
          <span className={css.montando} role="status">
            <LoaderCircle size={18} aria-hidden="true" className={css.girar} />
            Montando a prova…
          </span>
        )}
        <button type="button" className={css.botaoBarra} disabled={!pronto} onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </button>
        <MenuBaixar
          provaId={provaId}
          qual={qual}
          noPdf={pdf}
          desabilitado={!pronto}
          classeBotao={`${css.botaoBarra} ${css.botaoDestaque}`}
        />
      </div>

      {avisoPdf && (
        <div className={css.aviso} role="status">
          <span>
            Na janela de impressão, escolha <strong>Salvar como PDF</strong> no destino.
          </span>
          <button type="button" onClick={() => setAvisoPdf(false)}>Fechar</button>
        </div>
      )}

      <div className={css.area} style={{ "--escala": escala } as CSSProperties}>
        {pronto ? (
          <div ref={paginasRef} className={css.paginas}>
            {resultado.paginas.map((pag, n) => (
              <div key={`${qual}-${n}`} className={css.caixaFolha}>
                {folha(
                  n,
                  resultado.paginas.length,
                  pag.colunas.map((coluna, c) => (
                    <div key={c} className={css.coluna}>
                      {coluna.map((i) => (
                        <div key={i} className={css.bloco}>
                          <Bloco
                            item={itens[i]}
                            bolinhas={bolinhas}
                            alturaMaximaFigura={i in pag.reduzir ? pag.reduzir[i] - (resultado.extras[i] ?? 0) : undefined}
                          />
                        </div>
                      ))}
                    </div>
                  )),
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={css.esperando}>Montando a prova…</div>
        )}
      </div>

      {!pronto && (
        <div ref={medicao} className={css.medicao} aria-hidden="true">
          {folha(0, 1, null, { "data-colunas-primeira": "" })}
          {folha(1, 2, null, { "data-colunas-demais": "" })}
          <div className={css.medicaoColuna}>
            {itens.map((item, i) => (
              <div key={i} data-bloco="" className={css.bloco}>
                <Bloco item={item} bolinhas={bolinhas} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
