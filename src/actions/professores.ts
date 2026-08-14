"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirAdmin } from "@/lib/auth";
import type { Professor, ProfessorRole } from "@/lib/types";

export async function listarProfessores(): Promise<Professor[]> {
  await exigirAdmin();
  const { data, error } = await supabase
    .from("professores")
    .select("id, nome, email, role, email_verificado, created_at")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Confirma o email de um professor sem depender do envio de email (ex.: quando o Resend recusa o destinatário). */
export async function verificarProfessorManualmente(id: string): Promise<void> {
  await exigirAdmin();
  const { error } = await supabase
    .from("professores")
    .update({ email_verificado: true, token_verificacao: null, token_verificacao_expira: null })
    .eq("id", id);
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
    .select("id, nome, email, role, email_verificado, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
