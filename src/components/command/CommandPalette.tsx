"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, History, KeyRound, LogOut, Search, Users } from "lucide-react";
import type { Turma } from "@/lib/types";
import { filtrarComandos, trechosDestacados, type ItemComando } from "@/lib/comandos";
import { buscarAlunos, type AlunoBusca } from "@/actions/busca";
import { logout } from "@/actions/auth";
import { useComandos } from "./CommandProvider";

type CommandPaletteProps = {
  turmas: Turma[];
  ehAdmin: boolean;
};

const ORDEM_GRUPOS: ItemComando["grupo"][] = ["Alunos", "Turmas", "Ações"];

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function CommandPalette({ turmas, ehAdmin }: CommandPaletteProps) {
  const router = useRouter();
  const { aberto, abrir, fechar, acoesContextuais } = useComandos();
  const [termo, setTermo] = useState("");
  // Resultado da busca guardado junto com o termo que o gerou; a lista exibida é derivada.
  const [resultado, setResultado] = useState<{ termo: string; alunos: AlunoBusca[] }>({ termo: "", alunos: [] });
  const [indice, setIndice] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listaId = useId();

  // Atalho global. Não abre enquanto uma célula da planilha está em edição.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      const alvo = e.target instanceof Element ? e.target : null;
      if (alvo?.closest("[data-bloqueia-atalhos]")) return;
      e.preventDefault();
      if (aberto) fechar();
      else abrir();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, abrir, fechar]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !aberto) return;
    const anterior = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      setTermo("");
      setResultado({ termo: "", alunos: [] });
      setIndice(0);
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [aberto]);

  // Busca de alunos com debounce; só com 2+ caracteres.
  const termoLimpo = termo.trim();
  const alunos = aberto && termoLimpo.length >= 2 && resultado.termo === termoLimpo ? resultado.alunos : [];

  useEffect(() => {
    const limpo = termo.trim();
    if (!aberto || limpo.length < 2) return;
    let cancelado = false;
    const t = setTimeout(() => {
      buscarAlunos(limpo)
        .then((r) => !cancelado && setResultado({ termo: limpo, alunos: r }))
        .catch(() => !cancelado && setResultado({ termo: limpo, alunos: [] }));
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [termo, aberto]);

  const irPara = (href: string) => () => {
    fechar();
    router.push(href);
  };

  const itens = useMemo(() => {
    const itensAlunos: ItemComando[] = alunos.map((a) => ({
      id: `aluno-${a.id}`,
      grupo: "Alunos",
      rotulo: a.nome,
      detalhe: `${a.turmaNome} · ${a.turmaBimestre}`,
      // O nonce t faz o drawer reabrir mesmo quando o mesmo aluno é buscado de novo.
      executar: () => irPara(`/turma/${a.turmaId}?aluno=${a.id}&t=${Date.now()}`)(),
    }));
    const itensTurmas: ItemComando[] = turmas.map((t) => ({
      id: `turma-${t.id}`,
      grupo: "Turmas",
      rotulo: `${t.nome} · ${t.bimestre}`,
      executar: irPara(`/turma/${t.id}`),
    }));
    const acoesFixas: ItemComando[] = [
      { id: "ir-turmas", grupo: "Ações", rotulo: "Ir para turmas", palavrasChave: ["inicio", "home"], executar: irPara("/") },
      ...(ehAdmin
        ? ([
            { id: "ir-professores", grupo: "Ações", rotulo: "Professores", palavrasChave: ["admin"], executar: irPara("/admin/professores") },
            { id: "ir-historico", grupo: "Ações", rotulo: "Histórico de alterações", palavrasChave: ["admin", "log"], executar: irPara("/admin/historico") },
          ] satisfies ItemComando[])
        : []),
      { id: "trocar-senha", grupo: "Ações", rotulo: "Trocar senha", palavrasChave: ["senha", "password"], executar: irPara("/trocar-senha") },
      {
        id: "sair",
        grupo: "Ações",
        rotulo: "Sair",
        palavrasChave: ["logout"],
        executar: () => {
          fechar();
          void logout();
        },
      },
    ];
    // Alunos já vêm filtrados do servidor; turmas e ações filtram aqui.
    return [
      ...itensAlunos,
      ...filtrarComandos(itensTurmas, termo),
      ...filtrarComandos([...acoesContextuais, ...acoesFixas], termo),
    ];
    // irPara é recriada a cada render, mas só depende de router/fechar, que são estáveis
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunos, turmas, termo, ehAdmin, acoesContextuais]);

  const indiceSeguro = itens.length === 0 ? -1 : Math.min(indice, itens.length - 1);

  function aoTeclarNoInput(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (itens.length ? (i + 1) % itens.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (itens.length ? (i - 1 + itens.length) % itens.length : 0));
    } else if (e.key === "Enter" && indiceSeguro >= 0) {
      e.preventDefault();
      itens[indiceSeguro].executar();
    }
  }

  const icone = (item: ItemComando) => {
    if (item.grupo === "Alunos") return <span className="text-[10px] font-bold">{iniciais(item.rotulo)}</span>;
    if (item.grupo === "Turmas") return <GraduationCap size={14} />;
    if (item.id === "ir-professores") return <Users size={14} />;
    if (item.id === "ir-historico") return <History size={14} />;
    if (item.id === "trocar-senha") return <KeyRound size={14} />;
    if (item.id === "sair") return <LogOut size={14} />;
    return <span aria-hidden="true">→</span>;
  };

  if (!aberto) return null;

  const opcaoId = (i: number) => `${listaId}-op-${i}`;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Paleta de comandos"
      className="fixed inset-x-0 top-[12vh] mx-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-float border border-white bg-white/85 p-0 text-ink shadow-float backdrop-blur-xl backdrop-saturate-150 backdrop:bg-frame-deep/40 backdrop:backdrop-blur-sm"
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fechar();
      }}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Search size={18} className="shrink-0 text-faint" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listaId}
          aria-activedescendant={indiceSeguro >= 0 ? opcaoId(indiceSeguro) : undefined}
          aria-label="Buscar alunos, turmas e ações"
          placeholder="Buscar alunos, turmas e ações…"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setIndice(0);
          }}
          onKeyDown={aoTeclarNoInput}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
        <kbd className="rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
      </div>

      <div id={listaId} role="listbox" aria-label="Resultados" className="max-h-[50vh] overflow-y-auto py-2">
        {itens.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {termo.trim().length >= 2 ? "Nada encontrado." : "Digite para buscar."}
          </p>
        )}
        {ORDEM_GRUPOS.map((grupo) => {
          const doGrupo = itens.map((item, i) => ({ item, i })).filter(({ item }) => item.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <div key={grupo} role="group" aria-label={grupo}>
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{grupo}</p>
              {doGrupo.map(({ item, i }) => {
                const ativo = i === indiceSeguro;
                return (
                  <div
                    key={item.id}
                    id={opcaoId(i)}
                    role="option"
                    aria-selected={ativo}
                    onMouseMove={() => setIndice(i)}
                    onClick={() => item.executar()}
                    className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm ${
                      ativo ? "bg-brand/[0.06] shadow-[inset_3px_0_0_var(--color-gold)]" : ""
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${ativo ? "bg-brand text-white" : "bg-surface-sunken text-muted"}`}>
                      {icone(item)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {trechosDestacados(item.rotulo, termo).map((p, k) =>
                          p.destaque ? (
                            <mark key={k} className="rounded-[3px] bg-gold/50 text-inherit">{p.texto}</mark>
                          ) : (
                            <span key={k}>{p.texto}</span>
                          )
                        )}
                      </span>
                      {item.detalhe && <span className="block truncate text-xs text-muted">{item.detalhe}</span>}
                    </span>
                    {ativo && (
                      <kbd className="shrink-0 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">↵</kbd>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 border-t border-line bg-surface-sunken/80 px-4 py-2 text-[11px] text-muted">
        <span>↑↓ navegar</span>
        <span>↵ abrir</span>
        <span>esc fechar</span>
      </div>
    </dialog>
  );
}
