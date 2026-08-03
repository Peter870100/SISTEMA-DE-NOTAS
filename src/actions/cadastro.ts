"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { enviarEmailVerificacao } from "@/lib/email";
import { obterCodigoConvite } from "@/lib/configuracoes";

export async function cadastrar(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const codigo = String(formData.get("codigo") ?? "").trim();

  const codigoEsperado = await obterCodigoConvite();
  if (!codigoEsperado || codigo !== codigoEsperado) {
    redirect("/cadastro?erro=codigo");
  }
  if (!nome || !email || !senha) {
    redirect("/cadastro?erro=campos");
  }

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

  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verificar-email?token=${token}`;
  try {
    await enviarEmailVerificacao(email, nome, link);
  } catch {
    redirect("/cadastro?erro=email");
  }

  redirect("/cadastro?enviado=1");
}
