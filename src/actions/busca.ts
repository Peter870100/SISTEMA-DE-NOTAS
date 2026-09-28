"use server";

import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual, turmasLiberadasPara } from "@/lib/auth";

export type AlunoBusca = {
  id: string;
  nome: string;
  turmaId: string;
  turmaNome: string;
  turmaBimestre: string;
};

/**
 * Busca de alunos pelo nome pro Ctrl+K. Só devolve alunos de turmas que o
 * professor logado pode acessar; sem login, não devolve nada.
 */
export async function buscarAlunos(termo: string): Promise<AlunoBusca[]> {
  const professor = await getProfessorAtual();
  if (!professor) return [];

  const limpo = termo.trim();
  if (limpo.length < 2) return [];
  const padrao = `%${limpo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const { data: alunos, error } = await supabase
    .from("alunos")
    .select("id, nome, turma_id")
    .ilike("nome", padrao)
    .order("nome")
    .limit(40);
  if (error) throw new Error(error.message);
  if (!alunos || alunos.length === 0) return [];

  const turmaIds = [...new Set(alunos.map((a) => a.turma_id))];
  const { data: turmas, error: erroTurmas } = await supabase
    .from("turmas")
    .select("id, nome, bimestre")
    .in("id", turmaIds);
  if (erroTurmas) throw new Error(erroTurmas.message);

  const liberadas = await turmasLiberadasPara(professor);
  const turmaPorId = new Map((turmas ?? []).map((t) => [t.id, t]));

  const resultado: AlunoBusca[] = [];
  for (const a of alunos) {
    const turma = turmaPorId.get(a.turma_id);
    if (!turma) continue;
    if (liberadas !== null && !liberadas.has(turma.nome)) continue;
    resultado.push({ id: a.id, nome: a.nome, turmaId: turma.id, turmaNome: turma.nome, turmaBimestre: turma.bimestre });
    if (resultado.length === 8) break;
  }
  return resultado;
}
