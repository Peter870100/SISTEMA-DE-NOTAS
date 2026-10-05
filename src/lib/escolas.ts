import { cache } from "react";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabase/client";
import { escolaDoHost, urlDaEscola } from "@/lib/dominio";
import type { Escola } from "@/lib/types";

export const ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001";

export const obterEscola = cache(async (id: string): Promise<Escola> => {
  const { data, error } = await supabase.from("escolas").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Escola não encontrada.");
  return data;
});

/** Escola das telas antes do login (por enquanto, sempre o Colégio Status). */
export const obterEscolaPadrao = cache(() => obterEscola(ESCOLA_PADRAO_ID));

export const obterEscolaPorSlug = cache(async (slug: string): Promise<Escola | null> => {
  const { data } = await supabase.from("escolas").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
});

/** Escola do endereço desta requisição (marca e onde o login vale). Nunca usar para dar acesso. */
export async function escolaDoEndereco(): Promise<Escola | null> {
  const slug = escolaDoHost((await headers()).get("host"));
  return slug ? obterEscolaPorSlug(slug) : null;
}

/** Link absoluto para e-mails: endereço da escola em produção; em teste/preview, o endereço do app. */
export function linkDaEscola(escola: Pick<Escola, "slug">, caminho: string): string {
  if (process.env.VERCEL_ENV === "production") return urlDaEscola(escola.slug, caminho);
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
