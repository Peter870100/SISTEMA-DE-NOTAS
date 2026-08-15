"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdmin } from "@/lib/auth";

export type HistoricoLinha = {
  id: string;
  created_at: string;
  valor_anterior: number | null;
  status_anterior: string | null;
  valor_novo: number | null;
  status_novo: string | null;
  professor_nome: string | null;
  aluno_nome: string | null;
  turma_nome: string | null;
  atividade_titulo: string | null;
};

/** Últimas alterações de nota feitas por professores comuns (admin não entra aqui). */
export async function listarHistorico(): Promise<HistoricoLinha[]> {
  await exigirAdmin();
  const { data: linhas, error } = await supabase
    .from("notas_historico")
    .select("id, created_at, valor_anterior, status_anterior, valor_novo, status_novo, aluno_id, coluna_id, alterado_por")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  if (!linhas || linhas.length === 0) return [];

  const alunoIds = [...new Set(linhas.map((l) => l.aluno_id))];
  const colunaIds = [...new Set(linhas.map((l) => l.coluna_id))];
  const professorIds = [...new Set(linhas.map((l) => l.alterado_por).filter((id): id is string => !!id))];

  const [{ data: alunos }, { data: colunas }, { data: professores }] = await Promise.all([
    supabase.from("alunos").select("id, nome, turma_id").in("id", alunoIds),
    supabase.from("atividades_colunas").select("id, titulo").in("id", colunaIds),
    professorIds.length
      ? supabase.from("professores").select("id, nome").in("id", professorIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  const turmaIds = [...new Set((alunos ?? []).map((a) => a.turma_id))];
  const { data: turmas } = turmaIds.length
    ? await supabase.from("turmas").select("id, nome").in("id", turmaIds)
    : { data: [] as { id: string; nome: string }[] };

  const nomeTurmaPorId = new Map((turmas ?? []).map((t) => [t.id, t.nome]));
  const alunoPorId = new Map((alunos ?? []).map((a) => [a.id, a]));
  const tituloColunaPorId = new Map((colunas ?? []).map((c) => [c.id, c.titulo]));
  const nomeProfessorPorId = new Map((professores ?? []).map((p) => [p.id, p.nome]));

  return linhas.map((l) => {
    const aluno = alunoPorId.get(l.aluno_id);
    return {
      id: l.id,
      created_at: l.created_at,
      valor_anterior: l.valor_anterior,
      status_anterior: l.status_anterior,
      valor_novo: l.valor_novo,
      status_novo: l.status_novo,
      professor_nome: l.alterado_por ? (nomeProfessorPorId.get(l.alterado_por) ?? null) : null,
      aluno_nome: aluno?.nome ?? null,
      turma_nome: aluno ? (nomeTurmaPorId.get(aluno.turma_id) ?? null) : null,
      atividade_titulo: tituloColunaPorId.get(l.coluna_id) ?? null,
    };
  });
}
