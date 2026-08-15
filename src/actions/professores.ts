"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirAdmin, getProfessorAtual } from "@/lib/auth";
import type { Professor, ProfessorRole } from "@/lib/types";

export async function listarProfessores(): Promise<Professor[]> {
  await exigirAdmin();
  const { data, error } = await supabase
    .from("professores")
    .select(
      "id, nome, email, role, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
    )
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Mapa professor_id -> nomes de turma liberados, pra exibir/editar no admin. */
export async function listarAcessoTurmasPorProfessor(): Promise<Record<string, string[]>> {
  await exigirAdmin();
  const { data, error } = await supabase.from("professor_turma_acesso").select("professor_id, turma_nome");
  if (error) throw new Error(error.message);
  const mapa: Record<string, string[]> = {};
  for (const row of data ?? []) {
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
  await exigirAdmin();

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
  await exigirAdmin();
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
  await exigirAdmin();
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
  const atual = await exigirAdmin().then(() => getProfessorAtual());
  if (atual?.id === id) {
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
  await exigirAdmin();

  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();
  if (!nomeLimpo || !emailLimpo || !senha) {
    throw new Error("Preencha nome, email e senha.");
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const { data, error } = await supabase
    .from("professores")
    .insert({
      nome: nomeLimpo,
      email: emailLimpo,
      senha_hash: senhaHash,
      role,
      email_verificado: true,
    })
    .select(
      "id, nome, email, role, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
    )
    .single();
  if (error) throw new Error(error.message);
  return data;
}
