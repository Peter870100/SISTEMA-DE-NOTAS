import type { SupabaseClient } from "@supabase/supabase-js";
import { ehAdmin } from "@/lib/papeis";
import type { ProfessorRole } from "@/lib/types";

/**
 * Alcance de quem pergunta à Hermes.
 * - dono: todas as escolas.
 * - professor: só a escola dele; `turmas` = nomes liberados (null = todas as turmas da escola).
 */
export type Escopo =
  | { tipo: "dono" }
  | { tipo: "professor"; escolaId: string; professorId: string; turmas: Set<string> | null; papel?: ProfessorRole };
// `papel` ausente conta como professor comum (regra mais estrita).

/** True se quem pergunta pode ver a turma `turmaNome` da escola `escolaId`. */
export function podeVerTurma(e: Escopo, escolaId: string, turmaNome: string): boolean {
  if (e.tipo === "dono") return true;
  if (e.escolaId !== escolaId) return false;
  return e.turmas === null || e.turmas.has(turmaNome);
}

const ERRO_TELEFONE = "Telefone não cadastrado como professor.";

/** Identifica o professor pelo telefone (em qualquer escola) e monta o escopo dele. */
export async function escopoDoTelefone(supabase: SupabaseClient, telefone: string | undefined): Promise<Escopo> {
  const tel = telefone?.trim();
  if (!tel) throw new Error(ERRO_TELEFONE);
  const { data, error } = await supabase
    .from("professores")
    .select("id, role, acesso_restrito, escola_id")
    .eq("telefone", tel)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(ERRO_TELEFONE);
  const p = data as { id: string; role: ProfessorRole; acesso_restrito: boolean; escola_id: string };
  let turmas: Set<string> | null = null;
  if (!ehAdmin(p.role) && p.acesso_restrito) {
    const { data: liberadas, error: e2 } = await supabase
      .from("professor_turma_acesso")
      .select("turma_nome")
      .eq("professor_id", p.id);
    if (e2) throw new Error(e2.message);
    turmas = new Set((liberadas ?? []).map((r: { turma_nome: string }) => r.turma_nome));
  }
  return { tipo: "professor", escolaId: p.escola_id, professorId: p.id, turmas, papel: p.role };
}
