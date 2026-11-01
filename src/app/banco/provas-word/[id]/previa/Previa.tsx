"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { itensGabarito, itensProva, type ItemFolha } from "@/lib/folha/estrutura";
import { paginar, type BlocoMedido, type PaginaPrevia } from "@/lib/folha/paginar";
import { dividirItem, tamanhoTexto, type BlocoDividido } from "@/lib/folha/dividir";
import type { DadosPrevia, FiguraTela } from "@/lib/folha/previa";
import { MenuBaixar } from "../../MenuBaixar";
import { Bloco, Cabecalho, Rodape, TopoSeguintes, VARIAVEIS_FOLHA, type Qual } from "./Folha";
import css from "./Previa.module.css";

/** Largura de uma folha A4 em px CSS (210 mm a 96 dpi). */
const LARGURA_FOLHA_PX = (210 * 96) / 25.4;
/** Folga por coluna (px) para diferenças pequenas entre a tela e a impressão. */
const FOLGA_COLUNA = 3;

/** Rodadas de divisão de texto alto demais antes de paginar mesmo assim. */
const MAX_RODADAS = 4;

type BlocoTela = BlocoDividido<FiguraTela>;
type Resultado = { qual: Qual; blocos: BlocoTela[]; paginas: PaginaPrevia[]; extras: Record<number, number> };
type Divididos = { qual: Qual; blocos: BlocoTela[]; rodada: number };

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
  const [divididos, setDivididos] = useState<Divididos | null>(null);
  const [erro, setErro] = useState<Qual | null>(null);
  const [avisoPdf, setAvisoPdf] = useState(false);
  /** Impressão pedida (Imprimir, PDF ou `?imprimir=1`): sai quando as folhas estiverem prontas. */
  const [pedidoImpressao, setPedidoImpressao] = useState(false);
  const medicao = useRef<HTMLDivElement>(null);
  const paginasRef = useRef<HTMLDivElement>(null);
  const impressaoAutomatica = useRef(false);
  const imprimindo = useRef(false);

  const itens = useMemo(
    () => (qual === "prova" ? itensProva(dados.questoes, dados.avisoFinal) : itensGabarito(dados.questoes, dados.avisoFinal)),
    [dados, qual],
  );
  const base = useMemo<BlocoTela[]>(() => itens.map((item) => ({ item })), [itens]);
  const blocos = divididos?.qual === qual ? divididos.blocos : base;
  const rodada = divididos?.qual === qual ? divididos.rodada : 0;
  const pronto = resultado?.qual === qual;
  const falhou = erro === qual;

  // Mede cada bloco na largura da coluna e distribui nas páginas (de novo a cada troca Prova/Gabarito).
  useEffect(() => {
    if (pronto || falhou || !montado) return;
    const raiz = medicao.current;
    if (!raiz) return;
    let vivo = true;
    (async () => {
      try {
        await esperarCarregar(raiz);
        if (!vivo) return;
        const medidos: BlocoMedido[] = [];
        const extras: Record<number, number> = {};
        raiz.querySelectorAll<HTMLElement>("[data-bloco]").forEach((el, i) => {
          const altura = el.getBoundingClientRect().height;
          medidos.push({ altura, grudaNoProximo: !blocos[i].parte && grudaNoProximo(blocos[i].item) });
          const img = el.querySelector("img[data-figura]");
          if (img) extras[i] = altura - img.getBoundingClientRect().height;
        });
        if (medidos.length !== blocos.length) throw new Error("Medição incompleta.");
        const altura = (sel: string) => (raiz.querySelector(sel)?.getBoundingClientRect().height ?? 0) - FOLGA_COLUNA;
        const alturaPrimeira = altura("[data-colunas-primeira]");
        const alturaDemais = altura("[data-colunas-demais]");

        // Texto mais alto que a coluna (contando a faixa/título grudados antes dele) é dividido em
        // pedaços e medido de novo; o `reduzir` do paginador fica só para figuras.
        if (rodada < MAX_RODADAS) {
          const limite = Math.min(alturaPrimeira, alturaDemais);
          const novos: BlocoTela[] = [];
          let cabeca = 0;
          let mudou = false;
          blocos.forEach((b, i) => {
            const h = medidos[i].altura;
            const disponivel = limite - cabeca;
            const total = tamanhoTexto(b.item);
            const partes =
              h > disponivel && total > 0
                ? dividirItem(b.item, Math.max(20, Math.floor((total * disponivel * 0.9) / h)), b.parte)
                : null;
            if (partes) {
              novos.push(...partes);
              mudou = true;
            } else {
              novos.push(b);
            }
            cabeca = medidos[i].grudaNoProximo ? cabeca + h : 0;
          });
          if (mudou) {
            setDivididos({ qual, blocos: novos, rodada: rodada + 1 });
            return;
          }
        }

        const paginas = paginar(medidos, alturaPrimeira, alturaDemais);
        setResultado({ qual, blocos, paginas, extras });
        if (imprimir && !impressaoAutomatica.current) {
          impressaoAutomatica.current = true;
          setAvisoPdf(true);
          setPedidoImpressao(true);
        }
      } catch (e) {
        console.error("Pré-visualização: falha ao montar as folhas", e);
        if (vivo) setErro(qual);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [blocos, rodada, qual, pronto, falhou, montado, imprimir]);

  // Imprime depois que as folhas estão no DOM (o efeito roda após o commit) e as imagens carregaram.
  useEffect(() => {
    if (!pedidoImpressao || !pronto || imprimindo.current) return;
    imprimindo.current = true;
    (async () => {
      if (paginasRef.current) await esperarCarregar(paginasRef.current);
      requestAnimationFrame(() => {
        window.print();
        imprimindo.current = false;
        setPedidoImpressao(false);
      });
    })();
  }, [pedidoImpressao, pronto]);

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
    setPedidoImpressao(true);
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
        {!pronto && !falhou && (
          <span className={css.montando} role="status">
            <LoaderCircle size={18} aria-hidden="true" className={css.girar} />
            Montando a prova…
          </span>
        )}
        <button type="button" className={css.botaoBarra} disabled={!pronto} onClick={() => setPedidoImpressao(true)}>
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </button>
        {falhou ? (
          <a href={`/api/provas-word/${provaId}/${qual}`} className={`${css.botaoBarra} ${css.botaoDestaque}`}>
            <Download size={16} aria-hidden="true" />
            Baixar Word
          </a>
        ) : (
          <MenuBaixar
            provaId={provaId}
            qual={qual}
            noPdf={pdf}
            desabilitado={!pronto}
            classeBotao={`${css.botaoBarra} ${css.botaoDestaque}`}
          />
        )}
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
                      {coluna.map((i) => {
                        const b = resultado.blocos[i];
                        // `reduzir` só vale para figura; texto alto já foi dividido antes de paginar.
                        const reduzir = b.item.tipo === "figura" && i in pag.reduzir ? pag.reduzir[i] - (resultado.extras[i] ?? 0) : undefined;
                        return (
                          <div key={i} className={css.bloco}>
                            <Bloco item={b.item} parte={b.parte} bolinhas={bolinhas} alturaMaximaFigura={reduzir} />
                          </div>
                        );
                      })}
                    </div>
                  )),
                )}
              </div>
            ))}
          </div>
        ) : falhou ? (
          <div className={css.esperando} role="alert">
            Não foi possível montar a pré-visualização. Baixe a prova em Word.
          </div>
        ) : (
          <div className={css.esperando}>Montando a prova…</div>
        )}
      </div>

      {!pronto && !falhou && (
        <div ref={medicao} className={css.medicao} aria-hidden="true">
          {folha(0, 1, null, { "data-colunas-primeira": "" })}
          {folha(1, 2, null, { "data-colunas-demais": "" })}
          <div className={css.medicaoColuna}>
            {blocos.map((b, i) => (
              <div key={i} data-bloco="" className={css.bloco}>
                <Bloco item={b.item} parte={b.parte} bolinhas={bolinhas} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
