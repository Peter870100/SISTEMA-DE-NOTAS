"use server";

import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola } from "@/lib/escola-acesso";
import { configurarProfessorPor, definirSenhaProfessorPor, telefoneProfessorPor } from "@/lib/professores/nucleo";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { Professor, ProfessorRole } from "@/lib/types";

/** O admin logado como ator do núcleo de professores (só admin da escola). */
async function atorDoAdmin(): Promise<AtorEscola> {
  const admin = await exigirAdminDaEscola();
  return { id: admin.id, role: admin.role, escola_id: admin.escola_id, turmas: null, via: "app" };
}

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
  await configurarProfessorPor(await atorDoAdmin(), id, { restrito, turmas: turmaNomes });
}

/** Telefone usado pra identificar o professor no agente do Telegram. */
export async function atualizarTelefoneProfessor(id: string, telefone: string): Promise<void> {
  await telefoneProfessorPor(await atorDoAdmin(), id, telefone);
}

/**
 * Define uma senha provisória pro professor (ativa cadastros pendentes sem depender de email,
 * e também serve pra resetar a senha de quem já tem conta). Ele é forçado a trocar no próximo login.
 */
export async function definirSenhaProvisoria(id: string, senha: string): Promise<void> {
  await definirSenhaProfessorPor(await atorDoAdmin(), id, senha);
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
