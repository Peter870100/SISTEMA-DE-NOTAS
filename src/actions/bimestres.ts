"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export async function alterarBimestre(turmaId: string, acao: "encerrar" | "reabrir" | "ativar"): Promise<void> {
  const entrada = z.object({ turmaId: z.uuid(), acao: z.enum(["encerrar", "reabrir", "ativar"]) }).parse({ turmaId, acao });
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Entre como professor para gerenciar os bimestres.");
  const { data: turma, error: erroTurma } = await supabase.from("turmas").select("*").eq("id", entrada.turmaId).single();
  if (erroTurma || !turma) throw new Error("Turma não encontrada.");
  if (turma.escola_id !== professor.escola_id || !(await professorTemAcessoATurma(professor, turma.nome))) {
    throw new Error("Você não tem acesso a essa turma.");
  }
  const { data, error } = await supabase.rpc("alterar_situacao_bimestre", { p_turma_id: entrada.turmaId, p_acao: entrada.acao });
  if (error) {
    if (error.code === "PGRST202") throw new Error("O controle de bimestres ainda precisa ser ativado no banco de dados.");
    throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  for (const bimestre of data ?? []) revalidatePath(`/turma/${bimestre.id}`);
}
