import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, turmasLiberadasPara } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { podeAcessarTurma } from "@/lib/escola-regras";
import type { Aluno, AtividadeColuna, Professor, Turma } from "@/lib/types";

export async function exigirProfessorLogado(): Promise<Professor> {
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return professor;
}

export async function exigirAdminDaEscola(): Promise<Professor> {
  const professor = await exigirProfessorLogado();
  if (!ehAdmin(professor.role)) throw new Error("Apenas administradores podem fazer isso.");
  return professor;
}

export async function exigirTurmaDaEscola(professor: Professor, turmaId: string): Promise<Turma> {
  const { data: turma } = await supabase.from("turmas").select("*").eq("id", turmaId).maybeSingle();
  if (!turma || !podeAcessarTurma(professor, turma, await turmasLiberadasPara(professor))) throw new Error("Você não tem acesso a essa turma.");
  return turma;
}

export async function exigirAlunoDaEscola(professor: Professor, alunoId: string): Promise<{ aluno: Aluno; turma: Turma }> {
  const { data: aluno } = await supabase.from("alunos").select("*").eq("id", alunoId).maybeSingle();
  if (!aluno) throw new Error("Aluno não encontrado.");
  const turma = await exigirTurmaDaEscola(professor, aluno.turma_id).catch(() => null);
  if (!turma) throw new Error("Aluno não encontrado.");
  return { aluno, turma };
}

export async function exigirColunaDaEscola(professor: Professor, colunaId: string): Promise<{ coluna: AtividadeColuna; turma: Turma }> {
  const { data: coluna } = await supabase.from("atividades_colunas").select("*").eq("id", colunaId).maybeSingle();
  if (!coluna) throw new Error("Atividade não encontrada.");
  const turma = await exigirTurmaDaEscola(professor, coluna.turma_id).catch(() => null);
  if (!turma) throw new Error("Atividade não encontrada.");
  return { coluna, turma };
}

export async function turmasDaEscola(professor: Professor): Promise<Turma[]> {
  const { data, error } = await supabase.from("turmas").select("*").eq("escola_id", professor.escola_id).order("nome").order("bimestre");
  if (error) throw new Error(error.message);
  const liberadas = await turmasLiberadasPara(professor);
  return (data ?? []).filter((t) => podeAcessarTurma(professor, t, liberadas));
}
