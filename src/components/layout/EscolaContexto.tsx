"use client";

import Image from "next/image";
import { createContext, useContext } from "react";

import { MARCA_PADRAO, type MarcaEscola } from "@/lib/marca";

export type { MarcaEscola };

const Contexto = createContext<MarcaEscola>(MARCA_PADRAO);

export function EscolaProvider({ marca, children }: { marca: MarcaEscola; children: React.ReactNode }) {
  return <Contexto.Provider value={marca}>{children}</Contexto.Provider>;
}

export function useMarcaEscola(): MarcaEscola {
  return useContext(Contexto);
}

/** Logo branca de uma marca; sem imagem, o nome da escola em texto. */
export function LogoDaMarca({ marca, className }: { marca: Pick<MarcaEscola, "nome" | "logo_url">; className?: string }) {
  const { nome, logo_url } = marca;
  if (!logo_url) {
    return <span className={`font-display font-bold text-white ${className ?? ""}`}>{nome}</span>;
  }
  return <Image src={logo_url} alt={nome} width={1580} height={513} className={className} preload />;
}

/** Logo branca da escola de quem está logado. */
export function LogoEscola({ className }: { className?: string }) {
  return <LogoDaMarca marca={useMarcaEscola()} className={className} />;
}
