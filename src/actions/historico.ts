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

export type HistoricoPagina = {
  linhas: HistoricoLinha[];
  proximoCursor: string | null;
};

export type HistoricoFiltro = {
  turmaId?: string;
  professorId?: string;
  /** `created_at` da última linha da página anterior — busca só o que veio antes dela. */
  cursor?: string;
  limit?: number;
};

/**
 * Alterações de nota feitas por professores comuns (admin não entra aqui), paginadas por
 * `created_at` (mais recente primeiro) e opcionalmente filtradas por turma e/ou professor.
 */
export async function listarHistorico(filtro: HistoricoFiltro = {}): Promise<HistoricoPagina> {
  await exigirAdmin();
  const limite = filtro.limit ?? 50;

  let alunoIdsDaTurma: string[] | null = null;
  if (filtro.turmaId) {
    const { data } = await supabase.from("alunos").select("id").eq("turma_id", filtro.turmaId);
    alunoIdsDaTurma = (data ?? []).map((a) => a.id);
    if (alunoIdsDaTurma.length === 0) return { linhas: [], proximoCursor: null };
  }

  let query = supabase
    .from("notas_historico")
    .select("id, created_at, valor_anterior, status_anterior, valor_novo, status_novo, aluno_id, coluna_id, alterado_por")
    .order("created_at", { ascending: false })
    .limit(limite + 1);

  if (filtro.cursor) query = query.lt("created_at", filtro.cursor);
  if (filtro.professorId) query = query.eq("alterado_por", filtro.professorId);
  if (alunoIdsDaTurma) query = query.in("aluno_id", alunoIdsDaTurma);

  const { data: brutas, error } = await query;
  if (error) throw new Error(error.message);
  if (!brutas || brutas.length === 0) return { linhas: [], proximoCursor: null };

  const temMais = brutas.length > limite;
  const linhas = temMais ? brutas.slice(0, limite) : brutas;
  const proximoCursor = temMais ? linhas[linhas.length - 1].created_at : null;

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

  return {
    linhas: linhas.map((l) => {
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
    }),
    proximoCursor,
  };
}
