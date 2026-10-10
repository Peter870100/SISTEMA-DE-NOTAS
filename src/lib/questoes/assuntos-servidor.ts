import { supabase } from "@/lib/supabase/client";
import { ASSUNTOS_INICIAIS } from "./assuntos-iniciais";

/** Grava como aprovados os assuntos da lista inicial que ainda não existem; devolve quantos entraram. */
export async function inserirAssuntosIniciais(): Promise<number> {
  const linhas = Object.entries(ASSUNTOS_INICIAIS).flatMap(([materia, nomes]) => nomes.map((nome) => ({ materia, nome, situacao: "aprovado" as const })));
  const { data: existentes } = await supabase.from("assuntos").select("materia, nome");
  const chave = (m: string, n: string) => `${m}|${n.toLowerCase()}`;
  const ja = new Set((existentes ?? []).map((e) => chave(e.materia, e.nome)));
  const novas = linhas.filter((l) => !ja.has(chave(l.materia, l.nome)));
  if (novas.length) {
    const { error } = await supabase.from("assuntos").insert(novas);
    if (error) throw new Error(error.message);
  }
  return novas.length;
}
