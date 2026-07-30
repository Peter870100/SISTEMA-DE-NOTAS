"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual } from "@/lib/auth";
import type { Professor, ProfessorRole } from "@/lib/types";

async function exigirAdmin(): Promise<void> {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    throw new Error("Apenas administradores podem gerenciar professores.");
  }
}

export async function listarProfessores(): Promise<Professor[]> {
  await exigirAdmin();
  const { data, error } = await supabase
    .from("professores")
    .select("id, nome, email, role, created_at")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
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
    .insert({ nome: nomeLimpo, email: emailLimpo, senha_hash: senhaHash, role })
    .select("id, nome, email, role, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
