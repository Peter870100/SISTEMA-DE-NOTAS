"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
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
 *
 * A lista vai num portal em `document.body` com `position: fixed`, posta a partir do botão: assim
 * não é cortada por `overflow: hidden` nem fica sob o cartão seguinte (o hover com `transform` do
 * cartão cria contexto de empilhamento). Abre para cima quando não cabe embaixo e acompanha o botão
 * em rolagem/redimensionamento; fecha se o botão sair da tela.
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
  const lista = useRef<HTMLDivElement>(null);
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

  // Posiciona a lista junto ao botão antes da pintura e a cada quadro enquanto aberta (rolagem,
  // redimensionamento e o deslocamento do hover do cartão).
  useLayoutEffect(() => {
    if (!aberto) return;
    let quadro = 0;
    let ultimo = "";
    const posicionar = () => {
      const b = botao.current;
      const l = lista.current;
      if (!b || !l) return;
      const r = b.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
        setAberto(false);
        return;
      }
      const margem = 8;
      const folga = 6;
      const w = l.offsetWidth;
      const h = l.offsetHeight;
      let top = r.bottom + folga;
      if (top + h > vh - margem && r.top - folga - h >= margem) top = r.top - folga - h;
      const left = Math.max(margem, Math.min(r.right - w, vw - w - margem));
      const chave = `${Math.round(top)},${Math.round(left)}`;
      if (chave !== ultimo) {
        ultimo = chave;
        l.style.top = `${Math.round(top)}px`;
        l.style.left = `${Math.round(left)}px`;
        l.style.visibility = "visible";
      }
    };
    const laco = () => {
      posicionar();
      quadro = requestAnimationFrame(laco);
    };
    posicionar();
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    itens.current[0]?.focus({ preventScroll: true });
    function fora(e: PointerEvent) {
      const alvo = e.target as Node;
      if (raiz.current?.contains(alvo) || lista.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar(focarBotao: boolean) {
    setAberto(false);
    if (focarBotao) botao.current?.focus();
  }

  function teclaMenu(e: KeyboardEvent<HTMLDivElement>) {
    const focaveis = itens.current.filter((i): i is HTMLAnchorElement | HTMLButtonElement => !!i);
    const atual = focaveis.indexOf(document.activeElement as HTMLAnchorElement | HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const passo = e.key === "ArrowDown" ? 1 : -1;
      focaveis[(atual + passo + focaveis.length) % focaveis.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focaveis[e.key === "Home" ? 0 : focaveis.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // A lista está no fim do <body>: volta o foco ao botão e deixa o Tab seguir a partir dele.
      fechar(true);
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
      {aberto &&
        createPortal(
          <div
            ref={lista}
            id={idMenu}
            role="menu"
            aria-label="Baixar"
            className={css.menuLista}
            onKeyDown={teclaMenu}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
