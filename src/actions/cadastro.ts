"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { enviarEmailVerificacao } from "@/lib/email";
import { escolaDoEndereco, linkDaEscola } from "@/lib/escolas";

export async function cadastrar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim();

  const escola = await escolaDoEndereco();
  if (!escola || !escola.ativa) redirect("/cadastro?erro=codigo");
  const codigoEsperado = escola.codigo_convite_professor;
  if (!codigoEsperado || codigo !== codigoEsperado) {
    redirect("/cadastro?erro=codigo");
  }
  if (!nome || !email || !senha) {
    redirect("/cadastro?erro=campos");
  }

  const { data: contaAluno } = await supabase.from("alunos_contas").select("id").eq("email", email).maybeSingle();
  if (contaAluno) redirect("/cadastro?erro=duplicado");

  const { data: existente } = await supabase
    .from("professores")
    .select("id, email_verificado")
    .eq("email", email)
    .maybeSingle();

  if (existente?.email_verificado) {
    redirect("/cadastro?erro=duplicado");
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const dadosProfessor = {
    nome,
    email,
    senha_hash: senhaHash,
    escola_id: escola.id,
    role: "professor" as const,
    email_verificado: false,
    token_verificacao: token,
    token_verificacao_expira: expira,
  };

  const { error } = existente
    ? await supabase.from("professores").update(dadosProfessor).eq("id", existente.id)
    : await supabase.from("professores").insert(dadosProfessor);

  if (error) {
    redirect("/cadastro?erro=falha");
  }

  const link = linkDaEscola(escola, `/verificar-email?token=${token}`);
  try {
    await enviarEmailVerificacao(email, nome, link, escola);
  } catch {
    redirect("/cadastro?erro=email");
  }

  redirect("/cadastro?enviado=1");
}
