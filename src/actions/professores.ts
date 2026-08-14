"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirAdmin, getProfessorAtual } from "@/lib/auth";
import type { Professor, ProfessorRole } from "@/lib/types";

export async function listarProfessores(): Promise<Professor[]> {
  await exigirAdmin();
  const { data, error } = await supabase
    .from("professores")
    .select("id, nome, email, role, email_verificado, senha_provisoria, created_at")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
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
    .select("id, nome, email, role, email_verificado, senha_provisoria, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
