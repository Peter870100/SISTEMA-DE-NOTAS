import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import type { AlunoConta, Aula, Curso, Professor } from "@/lib/types";

export function podeEditarCurso(professor: Professor, curso: Curso): boolean {
  if (curso.escola_id !== professor.escola_id) return false;
  return curso.professor_id === professor.id || ehAdmin(professor.role);
}

/** Professor logado que pode editar o curso, e o curso. Lança erro caso contrário. */
export async function exigirCursoEditavel(cursoId: string): Promise<{ professor: Professor; curso: Curso }> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) throw new Error("Você não pode editar esse curso.");
  return { professor, curso };
}

export async function turmasDoAluno(contaId: string): Promise<{ turma_nome: string; ano_letivo: string }[]> {
  const { data } = await supabase.from("aluno_turmas").select("turma_nome, ano_letivo").eq("conta_id", contaId);
  return data ?? [];
}

/** Ids dos cursos da escola do aluno ligados a alguma turma dele. */
async function idsCursosDoAluno(aluno: AlunoConta): Promise<string[]> {
  const turmas = await turmasDoAluno(aluno.id);
  if (turmas.length === 0) return [];
  const { data } = await supabase
    .from("curso_turmas")
    .select("curso_id, turma_nome, ano_letivo")
    .eq("escola_id", aluno.escola_id)
    .in("turma_nome", [...new Set(turmas.map((t) => t.turma_nome))]);
  const chaves = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  return [...new Set((data ?? []).filter((l) => chaves.has(`${l.turma_nome}|${l.ano_letivo}`)).map((l) => l.curso_id))];
}

export async function cursosDoAluno(aluno: AlunoConta): Promise<Curso[]> {
  const ids = await idsCursosDoAluno(aluno);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("cursos").select("*").in("id", ids).eq("escola_id", aluno.escola_id).order("titulo");
  return data ?? [];
}

export async function cursoVisivelParaAluno(aluno: AlunoConta, cursoId: string): Promise<Curso | null> {
  const ids = await idsCursosDoAluno(aluno);
  if (!ids.includes(cursoId)) return null;
  const { data } = await supabase.from("cursos").select("*").eq("id", cursoId).eq("escola_id", aluno.escola_id).maybeSingle();
  return data ?? null;
}

/** Aula publicada de um curso visível para o aluno; null em qualquer outro caso. */
export async function obterAulaParaAluno(aluno: AlunoConta, aulaId: string): Promise<{ aula: Aula; curso: Curso } | null> {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).eq("publicada", true).maybeSingle();
  if (!aula) return null;
  const curso = await cursoVisivelParaAluno(aluno, aula.curso_id);
  return curso ? { aula, curso } : null;
}
