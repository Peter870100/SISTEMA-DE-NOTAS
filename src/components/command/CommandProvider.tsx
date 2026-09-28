"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ItemComando } from "@/lib/comandos";

type ComandosContexto = {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  acoesContextuais: ItemComando[];
  /** Registra ações da página atual (ex.: "Exportar Excel" na turma). Devolve a função de remoção. */
  registrarAcoes: (acoes: ItemComando[]) => () => void;
};

const Contexto = createContext<ComandosContexto | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [registros, setRegistros] = useState<{ chave: number; acoes: ItemComando[] }[]>([]);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  const registrarAcoes = useCallback((acoes: ItemComando[]) => {
    const chave = Math.random();
    setRegistros((prev) => [...prev, { chave, acoes }]);
    return () => setRegistros((prev) => prev.filter((r) => r.chave !== chave));
  }, []);

  const valor = useMemo(
    () => ({ aberto, abrir, fechar, acoesContextuais: registros.flatMap((r) => r.acoes), registrarAcoes }),
    [aberto, abrir, fechar, registros, registrarAcoes]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useComandos(): ComandosContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useComandos precisa estar dentro de <CommandProvider>");
  return ctx;
}

/** Versão tolerante pra componentes que também renderizam fora do provider (ex.: páginas deslogadas). */
export function useComandosOpcional(): ComandosContexto | null {
  return useContext(Contexto);
}
