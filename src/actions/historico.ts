"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola } from "@/lib/escola-acesso";

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

const BLOCO = 150;
const PAGINA_SUPABASE = 1000;

function emBlocos<T>(itens: T[]): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += BLOCO) blocos.push(itens.slice(i, i + BLOCO));
  return blocos;
}

/** Ids de todos os alunos das turmas dadas (em blocos, paginando além do limite de 1000 linhas). */
async function alunoIdsDasTurmas(turmaIds: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const bloco of emBlocos(turmaIds)) {
    for (let de = 0; ; de += PAGINA_SUPABASE) {
      const { data, error } = await supabase
        .from("alunos")
        .select("id")
        .in("turma_id", bloco)
        .order("id")
        .range(de, de + PAGINA_SUPABASE - 1);
      if (error) throw new Error(error.message);
      for (const a of data ?? []) ids.push(a.id);
      if ((data ?? []).length < PAGINA_SUPABASE) break;
    }
  }
  return ids;
}

/**
 * Alterações de nota feitas por professores comuns (admin não entra aqui), paginadas por
 * `created_at` (mais recente primeiro) e opcionalmente filtradas por turma e/ou professor.
 */
export async function listarHistorico(filtro: HistoricoFiltro = {}): Promise<HistoricoPagina> {
  const admin = await exigirAdminDaEscola();
  const limite = Math.min(Math.max(1, Math.trunc(Number(filtro.limit ?? 50)) || 50), 200);
  const vazia: HistoricoPagina = { linhas: [], proximoCursor: null };

  // Turmas da escola; um turmaId de fora da escola não devolve nada.
  const { data: turmasEscola, error: erroTurmas } = await supabase.from("turmas").select("id").eq("escola_id", admin.escola_id);
  if (erroTurmas) throw new Error(erroTurmas.message);
  let turmaIds = (turmasEscola ?? []).map((t) => t.id);
  if (filtro.turmaId) turmaIds = turmaIds.filter((id) => id === filtro.turmaId);
  if (turmaIds.length === 0) return vazia;

  if (filtro.professorId) {
    const { data: prof } = await supabase.from("professores").select("escola_id").eq("id", filtro.professorId).maybeSingle();
    if (!prof || prof.escola_id !== admin.escola_id) return vazia;
  }

  const alunoIds = await alunoIdsDasTurmas(turmaIds);
  if (alunoIds.length === 0) return vazia;

  const resultados = await Promise.all(
    emBlocos(alunoIds).map(async (bloco) => {
      let query = supabase
        .from("notas_historico")
        .select("id, created_at, valor_anterior, status_anterior, valor_novo, status_novo, aluno_id, coluna_id, alterado_por")
        .in("aluno_id", bloco)
        .order("created_at", { ascending: false })
        .limit(limite + 1);
      if (filtro.cursor) query = query.lt("created_at", filtro.cursor);
      if (filtro.professorId) query = query.eq("alterado_por", filtro.professorId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    })
  );
  const brutas = resultados.flat().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)).slice(0, limite + 1);
  if (brutas.length === 0) return vazia;
  return montarPagina(brutas, limite, admin.escola_id);
}

type LinhaBruta = {
  id: string;
  created_at: string;
  valor_anterior: number | null;
  status_anterior: string | null;
  valor_novo: number | null;
  status_novo: string | null;
  aluno_id: string;
  coluna_id: string;
  alterado_por: string | null;
};

async function montarPagina(brutas: LinhaBruta[], limite: number, escolaId: string): Promise<HistoricoPagina> {
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
      ? supabase.from("professores").select("id, nome").eq("escola_id", escolaId).in("id", professorIds)
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
