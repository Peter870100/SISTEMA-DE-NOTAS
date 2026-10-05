"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola } from "@/lib/escola-acesso";
import type { Professor, ProfessorRole } from "@/lib/types";

/** Carrega o professor-alvo e recusa se não for da escola do admin. */
async function exigirAlvoDaEscola(id: string, escolaId: string): Promise<{ id: string; role: ProfessorRole; escola_id: string }> {
  const { data: alvo } = await supabase.from("professores").select("id, role, escola_id").eq("id", id).maybeSingle();
  if (!alvo || alvo.escola_id !== escolaId) throw new Error("Professor não encontrado.");
  return alvo;
}

/** Só o dono pode mexer em outro dono; o alvo precisa ser da escola do admin. */
async function exigirPoderSobreAlvo(atual: Professor, id: string): Promise<void> {
  const alvo = await exigirAlvoDaEscola(id, atual.escola_id);
  if (atual.role === "dono") return;
  if (alvo.role === "dono") throw new Error("Apenas o dono pode alterar a conta do dono.");
}

export async function listarProfessores(): Promise<Professor[]> {
  const admin = await exigirAdminDaEscola();
  const { data, error } = await supabase
    .from("professores")
    .select(
      "id, nome, email, role, escola_id, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
    )
    .eq("escola_id", admin.escola_id)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Mapa professor_id -> nomes de turma liberados, pra exibir/editar no admin. */
export async function listarAcessoTurmasPorProfessor(): Promise<Record<string, string[]>> {
  const admin = await exigirAdminDaEscola();
  const { data: profs, error: erroProfs } = await supabase.from("professores").select("id").eq("escola_id", admin.escola_id);
  if (erroProfs) throw new Error(erroProfs.message);
  const ids = (profs ?? []).map((p) => p.id);
  const mapa: Record<string, string[]> = {};
  if (ids.length === 0) return mapa;
  const linhas: { professor_id: string; turma_nome: string }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from("professor_turma_acesso").select("professor_id, turma_nome").in("professor_id", ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
  }
  for (const row of linhas) {
    (mapa[row.professor_id] ??= []).push(row.turma_nome);
  }
  return mapa;
}

/** Define quais turmas (por nome) o professor pode acessar. `restrito = false` libera todas. */
export async function atualizarAcessoTurmas(
  id: string,
  restrito: boolean,
  turmaNomes: string[]
): Promise<void> {
  const admin = await exigirAdminDaEscola();
  await exigirPoderSobreAlvo(admin, id);

  if (restrito && turmaNomes.length > 0) {
    const { data: turmas, error: erroTurmas } = await supabase.from("turmas").select("nome").eq("escola_id", admin.escola_id);
    if (erroTurmas) throw new Error(erroTurmas.message);
    const nomesDaEscola = new Set((turmas ?? []).map((t) => t.nome));
    if (turmaNomes.some((n) => !nomesDaEscola.has(n))) throw new Error("Turma não encontrada.");
  }

  const { error: erroUpdate } = await supabase
    .from("professores")
    .update({ acesso_restrito: restrito })
    .eq("id", id);
  if (erroUpdate) throw new Error(erroUpdate.message);

  const { error: erroDelete } = await supabase.from("professor_turma_acesso").delete().eq("professor_id", id);
  if (erroDelete) throw new Error(erroDelete.message);

  if (restrito && turmaNomes.length > 0) {
    const { error: erroInsert } = await supabase
      .from("professor_turma_acesso")
      .insert(turmaNomes.map((turma_nome) => ({ professor_id: id, turma_nome })));
    if (erroInsert) throw new Error(erroInsert.message);
  }
}

/** Telefone usado pra identificar o professor no agente do Telegram. */
export async function atualizarTelefoneProfessor(id: string, telefone: string): Promise<void> {
  const admin = await exigirAdminDaEscola();
  await exigirAlvoDaEscola(id, admin.escola_id);
  const telefoneLimpo = telefone.trim();
  const { error } = await supabase
    .from("professores")
    .update({ telefone: telefoneLimpo || null })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Esse telefone já está em uso por outro professor.");
    throw new Error(error.message);
  }
}

/**
 * Define uma senha provisória pro professor (ativa cadastros pendentes sem depender de email,
 * e também serve pra resetar a senha de quem já tem conta). Ele é forçado a trocar no próximo login.
 */
export async function definirSenhaProvisoria(id: string, senha: string): Promise<void> {
  const admin = await exigirAdminDaEscola();
  await exigirPoderSobreAlvo(admin, id);
  if (senha.length < 6) {
    throw new Error("A senha provisória precisa ter pelo menos 6 caracteres.");
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  const { error } = await supabase
    .from("professores")
    .update({
      senha_hash: senhaHash,
      senha_provisoria: true,
      email_verificado: true,
      token_verificacao: null,
      token_verificacao_expira: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirProfessor(id: string): Promise<void> {
  const atual = await exigirAdminDaEscola();
  await exigirPoderSobreAlvo(atual, id);
  if (atual.id === id) {
    throw new Error("Você não pode excluir sua própria conta.");
  }
  const { error } = await supabase.from("professores").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function criarProfessor(
  nome: string,
  email: string,
  senha: string,
  role: ProfessorRole
): Promise<Professor> {
  const atual = await exigirAdminDaEscola();
  if (role !== "admin" && role !== "professor" && role !== "dono") {
    throw new Error("Papel inválido.");
  }
  if (role === "dono" && atual.role !== "dono") {
    throw new Error("Apenas o dono pode criar outro dono.");
  }

  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();
  if (!nomeLimpo || !emailLimpo || !senha) {
    throw new Error("Preencha nome, email e senha.");
  }

  const { data: contaAluno } = await supabase.from("alunos_contas").select("id").eq("email", emailLimpo).maybeSingle();
  if (contaAluno) throw new Error("Esse email já está em uso por uma conta de aluno.");

  const senhaHash = await bcrypt.hash(senha, 10);
  const { data, error } = await supabase
    .from("professores")
    .insert({
      nome: nomeLimpo,
      email: emailLimpo,
      senha_hash: senhaHash,
      role,
      escola_id: atual.escola_id,
      email_verificado: true,
    })
    .select(
      "id, nome, email, role, escola_id, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return data;
}
