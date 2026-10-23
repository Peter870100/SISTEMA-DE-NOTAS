import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import type { Importacao, Professor, Questao } from "@/lib/types";
import { podeEditarQuestao, podeImportar, type Ator } from "./regras";

export { podeEditarQuestao, podeVerQuestao, podeImportar, type Ator } from "./regras";

export async function exigirProfessor(): Promise<Professor> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return professor;
}

/** A questão, se o ator (sessão ou Hermes) pode editá-la. */
export async function exigirEditorQuestaoPor(ator: Ator, questaoId: string): Promise<Questao> {
  const { data: questao } = await supabase.from("questoes").select("*").eq("id", questaoId).maybeSingle();
  if (!questao || !podeEditarQuestao(ator, questao)) throw new Error("Você não pode editar essa questão.");
  return questao;
}

export async function exigirEditorQuestao(questaoId: string): Promise<{ professor: Professor; questao: Questao }> {
  const professor = await exigirProfessor();
  return { professor, questao: await exigirEditorQuestaoPor(professor, questaoId) };
}

/** A importação, se o ator (sessão ou Hermes) pode mexer nela. */
export async function exigirImportacaoPor(ator: Ator, importacaoId: string): Promise<{ importacao: Importacao }> {
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).maybeSingle();
  if (!importacao || !podeImportar(ator, importacao.escopo)) throw new Error("Importação não encontrada.");
  if (importacao.escopo === "escola" && importacao.escola_id !== ator.escola_id && ator.role !== "dono") {
    throw new Error("Importação não encontrada.");
  }
  return { importacao };
}

export async function exigirImportacao(importacaoId: string): Promise<{ professor: Professor; importacao: Importacao }> {
  const professor = await exigirProfessor();
  return { professor, ...(await exigirImportacaoPor(professor, importacaoId)) };
}
