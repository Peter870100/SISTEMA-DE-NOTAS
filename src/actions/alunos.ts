"use server";

import { supabase } from "@/lib/supabase/client";
import type { Aluno } from "@/lib/types";

export async function addAluno(
  turmaId: string,
  nome: string,
  ordem: number
): Promise<Aluno> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new Error("Nome do aluno não pode ser vazio");

  const { data, error } = await supabase
    .from("alunos")
    .insert({ turma_id: turmaId, nome: nomeLimpo, ordem })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar aluno");
  return data;
}

export async function deleteAluno(alunoId: string): Promise<void> {
  const { error } = await supabase.from("alunos").delete().eq("id", alunoId);
  if (error) throw new Error(error.message);
}
