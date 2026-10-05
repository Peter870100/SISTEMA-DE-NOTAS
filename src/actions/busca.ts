"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessorLogado, turmasDaEscola } from "@/lib/escola-acesso";

export type AlunoBusca = {
  id: string;
  nome: string;
  turmaId: string;
  turmaNome: string;
  turmaBimestre: string;
};

/**
 * Busca de alunos pelo nome pro Ctrl+K. Só devolve alunos de turmas que o
 * professor logado pode acessar (da escola dele); sem login, falha.
 */
export async function buscarAlunos(termo: string): Promise<AlunoBusca[]> {
  const professor = await exigirProfessorLogado();

  const limpo = termo.trim();
  if (limpo.length < 2) return [];
  const padrao = `%${limpo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const turmas = await turmasDaEscola(professor);
  if (turmas.length === 0) return [];
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));

  const resultado: AlunoBusca[] = [];
  const ids = turmas.map((t) => t.id);
  for (let i = 0; i < ids.length && resultado.length < 8; i += 150) {
    const { data: alunos, error } = await supabase
      .from("alunos")
      .select("id, nome, turma_id")
      .in("turma_id", ids.slice(i, i + 150))
      .ilike("nome", padrao)
      .order("nome")
      .limit(40);
    if (error) throw new Error(error.message);
    for (const a of alunos ?? []) {
      const turma = turmaPorId.get(a.turma_id);
      if (!turma) continue;
      resultado.push({ id: a.id, nome: a.nome, turmaId: turma.id, turmaNome: turma.nome, turmaBimestre: turma.bimestre });
      if (resultado.length === 8) break;
    }
  }
  return resultado;
}
