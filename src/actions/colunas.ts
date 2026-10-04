"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, exigirAcessoATurmaId, getProfessorAtual } from "@/lib/auth";
import type { AtividadeColuna, TipoColuna } from "@/lib/types";

export async function addColuna(
  turmaId: string,
  titulo: string,
  ordem: number,
  tipo: TipoColuna = "nota"
): Promise<AtividadeColuna> {
  await exigirNaoAluno();
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
  await exigirNaoAluno();
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
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (professor) {
    const { data: coluna } = await supabase
      .from("atividades_colunas")
      .select("turma_id")
      .eq("id", colunaId)
      .single();
    if (!coluna) throw new Error("Atividade não encontrada.");
    await exigirAcessoATurmaId(professor, coluna.turma_id);
  }

  const { data, error } = await supabase.rpc("lixeira_excluir", {
    p_tipo: "atividade",
    p_id: colunaId,
    p_ator: professor?.id ?? null,
    p_via: "app",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reordenarColunas(
  ordens: { id: string; ordem: number }[]
): Promise<void> {
  await exigirNaoAluno();
  for (const { id, ordem } of ordens) {
    const { error } = await supabase
      .from("atividades_colunas")
      .update({ ordem })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}
