"use server";

import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import type { Aluno } from "@/lib/types";

/** Remove acentos e caixa pra comparar títulos de atividade entre turmas diferentes. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Transfere um aluno pra outra turma sem perder as notas: pra cada nota já lançada,
 * procura uma atividade com o mesmo título (e tipo) na turma de destino — cria se não
 * existir — e move a nota pra lá. O aluno some da turma de origem e aparece na de destino
 * já com o que tinha lançado.
 */
export async function transferirAluno(alunoId: string, turmaDestinoId: string): Promise<void> {
  const [{ data: aluno }, { data: turmaDestino }] = await Promise.all([
    supabase.from("alunos").select("*").eq("id", alunoId).single(),
    supabase.from("turmas").select("*").eq("id", turmaDestinoId).single(),
  ]);
  if (!aluno) throw new Error("Aluno não encontrado.");
  if (!turmaDestino) throw new Error("Turma de destino não encontrada.");
  if (aluno.turma_id === turmaDestinoId) throw new Error("O aluno já está nessa turma.");

  const professor = await getProfessorAtual();
  if (professor && professor.role !== "admin") {
    const { data: turmaOrigem } = await supabase
      .from("turmas")
      .select("nome")
      .eq("id", aluno.turma_id)
      .single();
    const podeOrigem = turmaOrigem ? await professorTemAcessoATurma(professor, turmaOrigem.nome) : false;
    const podeDestino = await professorTemAcessoATurma(professor, turmaDestino.nome);
    if (!podeOrigem || !podeDestino) {
      throw new Error("Você não tem acesso a uma dessas turmas.");
    }
  }

  const [{ data: notasAluno }, { data: colunasOrigem }, { data: colunasDestino }] = await Promise.all([
    supabase.from("notas_celulas").select("*").eq("aluno_id", alunoId),
    supabase.from("atividades_colunas").select("*").eq("turma_id", aluno.turma_id),
    supabase.from("atividades_colunas").select("*").eq("turma_id", turmaDestinoId),
  ]);

  const colunaOrigemPorId = new Map((colunasOrigem ?? []).map((c) => [c.id, c]));
  const colunaDestinoPorChave = new Map(
    (colunasDestino ?? []).map((c) => [`${normalizar(c.titulo)}:${c.tipo}`, c])
  );
  let proximaOrdemDestino = (colunasDestino ?? []).reduce((max, c) => Math.max(max, c.ordem), -1) + 1;

  for (const nota of notasAluno ?? []) {
    const colunaOrigem = colunaOrigemPorId.get(nota.coluna_id);
    if (!colunaOrigem) continue;

    const chave = `${normalizar(colunaOrigem.titulo)}:${colunaOrigem.tipo}`;
    let colunaDestino = colunaDestinoPorChave.get(chave);
    if (!colunaDestino) {
      const { data: nova, error } = await supabase
        .from("atividades_colunas")
        .insert({
          turma_id: turmaDestinoId,
          titulo: colunaOrigem.titulo,
          tema: colunaOrigem.tema,
          peso: colunaOrigem.peso,
          tipo: colunaOrigem.tipo,
          ordem: proximaOrdemDestino,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      colunaDestino = nova;
      colunaDestinoPorChave.set(chave, colunaDestino);
      proximaOrdemDestino++;
    }

    const { error: erroUpsert } = await supabase.from("notas_celulas").upsert(
      {
        aluno_id: alunoId,
        coluna_id: colunaDestino.id,
        valor: nota.valor,
        status_texto: nota.status_texto,
        atualizado_por: nota.atualizado_por,
      },
      { onConflict: "aluno_id,coluna_id" }
    );
    if (erroUpsert) throw new Error(erroUpsert.message);

    if (nota.coluna_id !== colunaDestino.id) {
      await supabase.from("notas_celulas").delete().eq("id", nota.id);
    }
  }

  const { count } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("turma_id", turmaDestinoId);

  const { error: erroMove } = await supabase
    .from("alunos")
    .update({ turma_id: turmaDestinoId, ordem: count ?? 0 })
    .eq("id", alunoId);
  if (erroMove) throw new Error(erroMove.message);
}

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
