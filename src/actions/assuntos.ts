"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { inserirAssuntosIniciais } from "@/lib/questoes/assuntos-servidor";
import type { Assunto } from "@/lib/types";

async function exigirDono() {
  const professor = await exigirProfessor();
  if (professor.role !== "dono") throw new Error("Só o dono da plataforma gerencia assuntos.");
  return professor;
}

export async function listarAssuntos(): Promise<Assunto[]> {
  await exigirProfessor();
  const { data } = await supabase.from("assuntos").select("*").order("materia").order("nome");
  return data ?? [];
}

export async function aprovarAssunto(id: string): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("assuntos").update({ situacao: "aprovado" }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Move as questões do assunto proposto para o destino e apaga o proposto. */
export async function juntarAssunto(propostoId: string, destinoId: string): Promise<void> {
  await exigirDono();
  if (propostoId === destinoId) throw new Error("Escolha outro assunto.");
  const [{ data: proposto }, { data: destino }] = await Promise.all([
    supabase.from("assuntos").select("*").eq("id", propostoId).maybeSingle(),
    supabase.from("assuntos").select("*").eq("id", destinoId).maybeSingle(),
  ]);
  if (!proposto || !destino || proposto.materia !== destino.materia) throw new Error("Os assuntos precisam ser da mesma matéria.");
  const { error } = await supabase.from("questoes").update({ assunto_id: destinoId }).eq("assunto_id", propostoId);
  if (error) throw new Error(error.message);
  await supabase.from("assuntos").delete().eq("id", propostoId);
}

export async function carregarAssuntosIniciais(): Promise<number> {
  await exigirDono();
  return inserirAssuntosIniciais();
}
