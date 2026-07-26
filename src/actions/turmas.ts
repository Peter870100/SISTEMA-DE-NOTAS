"use server";

import { supabase } from "@/lib/supabase/client";
import type { Turma } from "@/lib/types";

/**
 * Cria um novo bimestre para a mesma turma (mesmo nome/ano letivo), copiando
 * a lista de alunos — mas sem as atividades e notas do bimestre atual, já que
 * é um período de avaliação novo.
 */
export async function criarBimestre(
  turmaAtualId: string,
  novoBimestre: string
): Promise<Turma> {
  const label = novoBimestre.trim();
  if (!label) throw new Error("Informe o nome do bimestre");

  const { data: turmaAtual, error: erroTurma } = await supabase
    .from("turmas")
    .select("nome, ano_letivo")
    .eq("id", turmaAtualId)
    .single();
  if (erroTurma || !turmaAtual) {
    throw new Error(erroTurma?.message ?? "Turma não encontrada");
  }

  const { data: novaTurma, error: erroNovaTurma } = await supabase
    .from("turmas")
    .insert({ nome: turmaAtual.nome, bimestre: label, ano_letivo: turmaAtual.ano_letivo })
    .select()
    .single();
  if (erroNovaTurma || !novaTurma) {
    throw new Error(erroNovaTurma?.message ?? "Falha ao criar bimestre");
  }

  const { data: alunosAtuais, error: erroAlunos } = await supabase
    .from("alunos")
    .select("nome, numero, ordem")
    .eq("turma_id", turmaAtualId)
    .order("ordem");
  if (erroAlunos) throw new Error(erroAlunos.message);

  if (alunosAtuais && alunosAtuais.length > 0) {
    const novosAlunos = alunosAtuais.map((a) => ({
      turma_id: novaTurma.id,
      nome: a.nome,
      numero: a.numero,
      ordem: a.ordem,
    }));
    const { error: erroInsereAlunos } = await supabase.from("alunos").insert(novosAlunos);
    if (erroInsereAlunos) throw new Error(erroInsereAlunos.message);
  }

  return novaTurma;
}
