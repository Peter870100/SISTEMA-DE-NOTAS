import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import type { Importacao, Professor, Questao } from "@/lib/types";
import { podeEditarQuestao, podeImportar } from "./regras";

export { podeEditarQuestao, podeVerQuestao, podeImportar, type Ator } from "./regras";

export async function exigirProfessor(): Promise<Professor> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return professor;
}

export async function exigirEditorQuestao(questaoId: string): Promise<{ professor: Professor; questao: Questao }> {
  const professor = await exigirProfessor();
  const { data: questao } = await supabase.from("questoes").select("*").eq("id", questaoId).maybeSingle();
  if (!questao || !podeEditarQuestao(professor, questao)) throw new Error("Você não pode editar essa questão.");
  return { professor, questao };
}

export async function exigirImportacao(importacaoId: string): Promise<{ professor: Professor; importacao: Importacao }> {
  const professor = await exigirProfessor();
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).maybeSingle();
  if (!importacao || !podeImportar(professor, importacao.escopo)) throw new Error("Importação não encontrada.");
  if (importacao.escopo === "escola" && importacao.escola_id !== professor.escola_id && professor.role !== "dono") {
    throw new Error("Importação não encontrada.");
  }
  return { professor, importacao };
}
