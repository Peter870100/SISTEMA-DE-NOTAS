"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessorLogado, exigirTurmaDaEscola, exigirColunaDaEscola } from "@/lib/escola-acesso";
import type { AtividadeColuna, TipoColuna } from "@/lib/types";

export async function addColuna(
  turmaId: string,
  titulo: string,
  ordem: number,
  tipo: TipoColuna = "nota"
): Promise<AtividadeColuna> {
  const professor = await exigirProfessorLogado();
  await exigirTurmaDaEscola(professor, turmaId);
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
  const professor = await exigirProfessorLogado();
  await exigirColunaDaEscola(professor, colunaId);
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Título da coluna não pode ser vazio");

  const { error } = await supabase
    .from("atividades_colunas")
    .update({ titulo: tituloLimpo })
    .eq("id", colunaId);
  if (error) throw new Error(error.message);
}

/** Manda a coluna (com notas e histórico) pra lixeira. Devolve o id do item na lixeira. */
export async function deleteColuna(colunaId: string): Promise<string> {
  const professor = await exigirProfessorLogado();
  await exigirColunaDaEscola(professor, colunaId);

  const { data, error } = await supabase.rpc("lixeira_excluir", {
    p_tipo: "atividade",
    p_id: colunaId,
    p_ator: professor.id,
    p_via: "app",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reordenarColunas(
  turmaId: string,
  ordens: { id: string; ordem: number }[]
): Promise<void> {
  const professor = await exigirProfessorLogado();
  await exigirTurmaDaEscola(professor, turmaId);
  for (const { id, ordem } of ordens) {
    const { error } = await supabase
      .from("atividades_colunas")
      .update({ ordem })
      .eq("id", id)
      .eq("turma_id", turmaId);
    if (error) throw new Error(error.message);
  }
}
