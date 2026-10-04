import { supabase } from "@/lib/supabase/client";
import type { AlunoTurma } from "@/lib/types";

export type ConviteValido = {
  id: string;
  codigo: string;
  escola_id: string;
  escola_nome: string;
  turma_nome: string;
  ano_letivo: string;
};

/** Liga a conta à turma do convite (sem duplicar) e conta mais um uso. */
export async function vincularContaAoConvite(contaId: string, convite: ConviteValido): Promise<void> {
  const { error } = await supabase.from("aluno_turmas").upsert(
    { conta_id: contaId, escola_id: convite.escola_id, turma_nome: convite.turma_nome, ano_letivo: convite.ano_letivo },
    { onConflict: "conta_id,turma_nome,ano_letivo", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
  const { data: atual } = await supabase.from("convites_turma").select("usos").eq("id", convite.id).single();
  await supabase.from("convites_turma").update({ usos: (atual?.usos ?? 0) + 1 }).eq("id", convite.id);
}

/** Turmas de uma conta. Chamar só com o id do aluno logado. */
export async function listarMinhasTurmas(contaId: string): Promise<AlunoTurma[]> {
  const { data } = await supabase
    .from("aluno_turmas")
    .select("*")
    .eq("conta_id", contaId)
    .order("ano_letivo", { ascending: false })
    .order("turma_nome");
  return data ?? [];
}
