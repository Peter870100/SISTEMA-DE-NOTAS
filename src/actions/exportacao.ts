"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirProfessorLogado, turmasDaEscola } from "@/lib/escola-acesso";
import type { Aluno, AtividadeColuna, NotaCelula, Turma } from "@/lib/types";

export type TurmaParaExportar = {
  turma: Turma;
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  notas: Pick<NotaCelula, "aluno_id" | "coluna_id" | "valor" | "status_texto">[];
};

// O PostgREST devolve no máximo 1000 linhas por consulta; somando todas as turmas passa disso.
const PAGINA = 1000;
// A lista de ids vai na URL do `.in(...)`; lotes pequenos evitam estourar o tamanho da URL.
const LOTE_IDS = 150;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Roda a consulta em lotes de ids e páginas de 1000 linhas, juntando tudo. */
async function buscarTudo<T>(ids: string[], consulta: (lote: string[], de: number, ate: number) => Pagina<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    const lote = ids.slice(i, i + LOTE_IDS);
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await consulta(lote, de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      todas.push(...(data ?? []));
      if (!data || data.length < PAGINA) break;
    }
  }
  return todas;
}

/**
 * Notas das turmas que o professor pode ver — de um bimestre, ou de todos quando
 * `bimestre` é null — pra exportar num Excel só. Só entram colunas de nota; as de
 * chamada (presença) ficam de fora.
 */
export async function dadosExportacao(bimestre: string | null): Promise<TurmaParaExportar[]> {
  const professor = await exigirProfessorLogado();

  const turmas = (await turmasDaEscola(professor)).filter((t) => bimestre === null || t.bimestre === bimestre);
  if (turmas.length === 0) return [];
  const turmaIds = turmas.map((t) => t.id);

  const [colunas, alunos] = await Promise.all([
    buscarTudo<AtividadeColuna>(turmaIds, (lote, de, ate) =>
      supabase.from("atividades_colunas").select("*").in("turma_id", lote).eq("tipo", "nota").order("ordem").order("id").range(de, ate)
    ),
    buscarTudo<Aluno>(turmaIds, (lote, de, ate) =>
      supabase.from("alunos").select("*").in("turma_id", lote).order("ordem").order("id").range(de, ate)
    ),
  ]);

  const notas = await buscarTudo<TurmaParaExportar["notas"][number]>(
    colunas.map((c) => c.id),
    (lote, de, ate) =>
      supabase
        .from("notas_celulas")
        .select("aluno_id, coluna_id, valor, status_texto")
        .in("coluna_id", lote)
        .order("id")
        .range(de, ate)
  );

  return turmas.map((turma) => {
    const colunasDaTurma = colunas.filter((c) => c.turma_id === turma.id);
    const idsColunas = new Set(colunasDaTurma.map((c) => c.id));
    return {
      turma,
      colunas: colunasDaTurma,
      alunos: alunos.filter((a) => a.turma_id === turma.id),
      notas: notas.filter((n) => idsColunas.has(n.coluna_id)),
    };
  });
}
