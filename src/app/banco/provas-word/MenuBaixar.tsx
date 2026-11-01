"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Download, FileText, Printer } from "lucide-react";
import { estilos } from "@/components/ui/estilos";
import css from "./ProvasWord.module.css";

type Qual = "prova" | "gabarito";
type Opcao = { rotulo: string; tipo: "word" | "pdf"; qual: Qual };

/**
 * Botão "Baixar ▾". Com `qual` (dentro da pré-visualização) mostra "Word" e "PDF" daquela folha;
 * sem `qual` (histórico) mostra prova e gabarito em Word e em PDF. Word baixa o .docx; PDF chama
 * `noPdf` quando há (impressão da própria pré-visualização) ou abre a pré-visualização em nova aba
 * já pedindo a impressão.
 */
export function MenuBaixar({
  provaId,
  qual,
  noPdf,
  classeBotao,
  desabilitado = false,
}: {
  provaId: string;
  qual?: Qual;
  noPdf?: (qual: Qual) => void;
  classeBotao?: string;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const idMenu = useId();

  const opcoes: Opcao[] = qual
    ? [
        { rotulo: "Word", tipo: "word", qual },
        { rotulo: "PDF", tipo: "pdf", qual },
      ]
    : [
        { rotulo: "Prova (Word)", tipo: "word", qual: "prova" },
        { rotulo: "Gabarito (Word)", tipo: "word", qual: "gabarito" },
        { rotulo: "Prova (PDF)", tipo: "pdf", qual: "prova" },
        { rotulo: "Gabarito (PDF)", tipo: "pdf", qual: "gabarito" },
      ];

  useEffect(() => {
    if (!aberto) return;
    itens.current[0]?.focus();
    function fora(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar(focarBotao: boolean) {
    setAberto(false);
    if (focarBotao) botao.current?.focus();
  }

  function teclaMenu(e: KeyboardEvent<HTMLDivElement>) {
    const lista = itens.current.filter((i): i is HTMLAnchorElement | HTMLButtonElement => !!i);
    const atual = lista.indexOf(document.activeElement as HTMLAnchorElement | HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const passo = e.key === "ArrowDown" ? 1 : -1;
      lista[(atual + passo + lista.length) % lista.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      lista[e.key === "Home" ? 0 : lista.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  function teclaBotao(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" && !aberto) {
      e.preventDefault();
      setAberto(true);
    }
  }

  function pdf(q: Qual) {
    setAberto(false);
    if (noPdf) noPdf(q);
    else window.open(`/banco/provas-word/${provaId}/previa?qual=${q}&imprimir=1`, "_blank", "noopener");
  }

  return (
    <div ref={raiz} className={css.menuBaixar}>
      <button
        ref={botao}
        type="button"
        disabled={desabilitado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={teclaBotao}
        className={classeBotao ?? estilos.botaoPrimario}
      >
        <Download size={16} aria-hidden="true" />
        Baixar
        <ChevronDown size={16} aria-hidden="true" className={aberto ? css.setaAberta : undefined} />
      </button>
      {aberto && (
        <div id={idMenu} role="menu" aria-label="Baixar" className={css.menuLista} onKeyDown={teclaMenu}>
          {opcoes.map((o, i) =>
            o.tipo === "word" ? (
              <a
                key={o.rotulo}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                role="menuitem"
                href={`/api/provas-word/${provaId}/${o.qual}`}
                onClick={() => setAberto(false)}
                className={css.menuItem}
              >
                <FileText size={16} aria-hidden="true" />
                {o.rotulo}
              </a>
            ) : (
              <button
                key={o.rotulo}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                type="button"
                role="menuitem"
                onClick={() => pdf(o.qual)}
                className={css.menuItem}
              >
                <Printer size={16} aria-hidden="true" />
                {o.rotulo}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
