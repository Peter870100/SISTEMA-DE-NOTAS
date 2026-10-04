"use client";

import Image from "next/image";
import { createContext, useContext } from "react";

export type MarcaEscola = { nome: string; logo_url: string };

const MARCA_PADRAO: MarcaEscola = { nome: "Colégio Status", logo_url: "/logo-status-branca.png" };
const Contexto = createContext<MarcaEscola>(MARCA_PADRAO);

export function EscolaProvider({ marca, children }: { marca: MarcaEscola; children: React.ReactNode }) {
  return <Contexto.Provider value={marca}>{children}</Contexto.Provider>;
}

export function useMarcaEscola(): MarcaEscola {
  return useContext(Contexto);
}

/** Logo branca da escola de quem está logado. */
export function LogoEscola({ className }: { className?: string }) {
  const { nome, logo_url } = useMarcaEscola();
  return <Image src={logo_url} alt={nome} width={1580} height={513} className={className} preload />;
}
