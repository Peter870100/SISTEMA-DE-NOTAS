"use server";

import { supabase } from "@/lib/supabase/client";
import type { AtividadeColuna, TipoColuna } from "@/lib/types";

export async function addColuna(
  turmaId: string,
  titulo: string,
  ordem: number,
  tipo: TipoColuna = "nota"
): Promise<AtividadeColuna> {
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Título da coluna não pode ser vazio");

  const { data, error } = await supabase
    .from("atividades_colunas")
    .insert({ turma_id: turmaId, titulo: tituloLimpo, tipo, ordem })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar coluna");
  return data;
}

export async function renameColuna(
  colunaId: string,
  titulo: string
): Promise<void> {
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Título da coluna não pode ser vazio");

  const { error } = await supabase
    .from("atividades_colunas")
    .update({ titulo: tituloLimpo })
    .eq("id", colunaId);
  if (error) throw new Error(error.message);
}

export async function deleteColuna(colunaId: string): Promise<void> {
  const { error } = await supabase
    .from("atividades_colunas")
    .delete()
    .eq("id", colunaId);
  if (error) throw new Error(error.message);
}

export async function reordenarColunas(
  ordens: { id: string; ordem: number }[]
): Promise<void> {
  for (const { id, ordem } of ordens) {
    const { error } = await supabase
      .from("atividades_colunas")
      .update({ ordem })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}
