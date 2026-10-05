"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirProfessorLogado, exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { mesmaEscola } from "@/lib/escola-regras";
import { gerarCodigoConvite, gerarSenhaProvisoria } from "@/lib/contas-aluno";
import type { Professor, Turma } from "@/lib/types";

export type PainelCodigoTurma = {
  convite: { id: string; codigo: string; expira_em: string | null; usos: number } | null;
  contas: { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null }[];
};

/** Professor logado com acesso à turma (da escola dele), e a turma. */
async function exigirTurma(turmaId: string): Promise<{ professor: Professor; turma: Turma }> {
  const professor = await exigirProfessorLogado();
  const turma = await exigirTurmaDaEscola(professor, turmaId);
  return { professor, turma };
}

async function montarPainel(turma: Turma): Promise<PainelCodigoTurma> {
  const [{ data: convite }, { data: vinculos }] = await Promise.all([
    supabase
      .from("convites_turma")
      .select("id, codigo, expira_em, usos")
      .eq("escola_id", turma.escola_id)
      .eq("turma_nome", turma.nome)
      .eq("ano_letivo", turma.ano_letivo)
      .eq("ativo", true)
      .maybeSingle(),
    supabase
      .from("aluno_turmas")
      .select("conta_id")
      .eq("escola_id", turma.escola_id)
      .eq("turma_nome", turma.nome)
      .eq("ano_letivo", turma.ano_letivo),
  ]);
  const ids = (vinculos ?? []).map((v) => v.conta_id);
  const { data: contas } = ids.length
    ? await supabase.from("alunos_contas").select("id, nome, usuario, email, ativo, ultimo_acesso").in("id", ids).order("nome")
    : { data: [] };
  return { convite: convite ?? null, contas: contas ?? [] };
}

export async function obterPainelCodigoTurma(turmaId: string): Promise<PainelCodigoTurma> {
  const { turma } = await exigirTurma(turmaId);
  return montarPainel(turma);
}

/** Gera um código novo para a turma e o ano; o anterior (se houver) é desativado. */
export async function gerarConviteTurma(turmaId: string, validadeDias: 7 | 30 | null): Promise<PainelCodigoTurma> {
  const { professor, turma } = await exigirTurma(turmaId);
  await supabase
    .from("convites_turma")
    .update({ ativo: false })
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo);

  const expira_em = validadeDias ? new Date(Date.now() + validadeDias * 86_400_000).toISOString() : null;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { error } = await supabase.from("convites_turma").insert({
      codigo: gerarCodigoConvite(),
      escola_id: turma.escola_id,
      turma_nome: turma.nome,
      ano_letivo: turma.ano_letivo,
      criado_por: professor.id,
      expira_em,
    });
    if (!error) return montarPainel(turma);
    if (error.code !== "23505") throw new Error(error.message); // 23505 = código repetido: sorteia de novo
  }
  throw new Error("Não foi possível gerar o código. Tente de novo.");
}

export async function desativarConviteTurma(turmaId: string): Promise<PainelCodigoTurma> {
  const { turma } = await exigirTurma(turmaId);
  await supabase
    .from("convites_turma")
    .update({ ativo: false })
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo);
  return montarPainel(turma);
}

/** Nova senha provisória para um aluno da turma. Devolvida uma vez para o professor repassar. */
export async function novaSenhaAlunoPeloProfessor(turmaId: string, contaId: string): Promise<string> {
  const { turma } = await exigirTurma(turmaId);
  const { data: vinculo } = await supabase
    .from("aluno_turmas")
    .select("conta_id")
    .eq("conta_id", contaId)
    .eq("escola_id", turma.escola_id)
    .eq("turma_nome", turma.nome)
    .eq("ano_letivo", turma.ano_letivo)
    .maybeSingle();
  if (!vinculo) throw new Error("Esse aluno não está nessa turma.");
  const { data: conta } = await supabase.from("alunos_contas").select("escola_id").eq("id", contaId).maybeSingle();
  if (!conta || !mesmaEscola(conta, turma.escola_id)) throw new Error("Esse aluno não está nessa turma.");

  const senha = gerarSenhaProvisoria();
  const { error } = await supabase
    .from("alunos_contas")
    .update({ senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true, email_verificado: true })
    .eq("id", contaId);
  if (error) throw new Error(error.message);
  return senha;
}
