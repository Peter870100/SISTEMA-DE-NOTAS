"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { COOKIE_NOME, assinarSessao, getProfessorAtual } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  const { data: professor } = await supabase
    .from("professores")
    .select("id, senha_hash, email_verificado, senha_provisoria")
    .eq("email", email)
    .maybeSingle();

  const senhaConfere = professor ? await bcrypt.compare(senha, professor.senha_hash) : false;
  if (!professor || !senhaConfere) {
    redirect("/login?erro=1");
  }
  if (!professor.email_verificado) {
    redirect("/login?erro=nao-verificado");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NOME, assinarSessao(professor.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect(professor.senha_provisoria ? "/trocar-senha" : "/");
}

export async function trocarSenha(formData: FormData) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  const { data: registro } = await supabase
    .from("professores")
    .select("senha_hash")
    .eq("id", professor.id)
    .single();

  const senhaConfere = registro ? await bcrypt.compare(senhaAtual, registro.senha_hash) : false;
  if (!senhaConfere) {
    redirect("/trocar-senha?erro=senha-atual");
  }
  if (novaSenha.length < 6) {
    redirect("/trocar-senha?erro=curta");
  }
  if (novaSenha !== confirmarSenha) {
    redirect("/trocar-senha?erro=confirmacao");
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  const { error } = await supabase
    .from("professores")
    .update({ senha_hash: senhaHash, senha_provisoria: false })
    .eq("id", professor.id);
  if (error) {
    redirect("/trocar-senha?erro=falha");
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NOME);
  redirect("/login");
}
