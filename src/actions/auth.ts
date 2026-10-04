"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { COOKIE_NOME, contaDoTokenRedefinicao, getProfessorAtual, iniciarSessao, segredo } from "@/lib/auth";
import { normalizarIdentificador, ehEmail } from "@/lib/contas-aluno";
import { enviarEmailRedefinicaoSenha } from "@/lib/email";
import { gerarTokenRedefinicao } from "@/lib/token-senha";

export async function login(formData: FormData) {
  const identificador = normalizarIdentificador(String(formData.get("identificador") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  if (!identificador || !senha) redirect("/login?erro=1");

  if (ehEmail(identificador)) {
    const { data: professor } = await supabase
      .from("professores")
      .select("id, senha_hash, email_verificado, senha_provisoria")
      .eq("email", identificador)
      .maybeSingle();
    if (professor) {
      if (!(await bcrypt.compare(senha, professor.senha_hash))) redirect("/login?erro=1");
      if (!professor.email_verificado) redirect("/login?erro=nao-verificado");
      await iniciarSessao("p", professor.id);
      redirect(professor.senha_provisoria ? "/trocar-senha" : "/");
    }
  }

  const { data: aluno } = await supabase
    .from("alunos_contas")
    .select("id, senha_hash, email_verificado, senha_provisoria, ativo, criado_via")
    .eq(ehEmail(identificador) ? "email" : "usuario", identificador)
    .maybeSingle();

  if (!aluno || !(await bcrypt.compare(senha, aluno.senha_hash))) redirect("/login?erro=1");
  if (!aluno.ativo) redirect("/login?erro=bloqueado");
  // Conta por código entra com email: precisa confirmar antes. Conta criada pela escola entra com usuário.
  if (aluno.criado_via === "convite" && !aluno.email_verificado) redirect("/login?erro=nao-verificado");

  await iniciarSessao("a", aluno.id);
  redirect(aluno.senha_provisoria ? "/aluno/trocar-senha" : "/aluno");
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

export async function pedirRedefinicaoSenha(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/esqueci-senha?erro=campos");

  const { data: professor } = await supabase
    .from("professores")
    .select("id, nome, senha_hash")
    .eq("email", email)
    .maybeSingle();

  // Mesma resposta exista ou não a conta, pra não revelar quais emails estão cadastrados.
  if (professor) {
    const token = gerarTokenRedefinicao(professor.id, professor.senha_hash, segredo());
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/redefinir-senha?token=${token}`;
    try {
      await enviarEmailRedefinicaoSenha(email, professor.nome, link);
    } catch {
      redirect("/esqueci-senha?erro=email");
    }
  }

  redirect("/esqueci-senha?enviado=1");
}

export async function redefinirSenha(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");
  const voltar = (erro: string) => redirect(`/redefinir-senha?token=${encodeURIComponent(token)}&erro=${erro}`);

  const conta = await contaDoTokenRedefinicao(token);
  if (!conta || conta.tipo !== "p") redirect("/redefinir-senha?erro=link");
  const professorId = conta.id;
  if (novaSenha.length < 6) voltar("curta");
  if (novaSenha !== confirmarSenha) voltar("confirmacao");

  // Quem abriu o link do email provou que é dono dele, então a conta fica verificada também.
  const senhaHash = await bcrypt.hash(novaSenha, 10);
  const { error } = await supabase
    .from("professores")
    .update({ senha_hash: senhaHash, senha_provisoria: false, email_verificado: true })
    .eq("id", professorId);
  if (error) voltar("falha");

  redirect("/login?senha-redefinida=1");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NOME);
  redirect("/login");
}
