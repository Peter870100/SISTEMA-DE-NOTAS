"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { normalizarCodigo } from "@/lib/codigo-convite";
import { normalizarIdentificador } from "@/lib/contas-aluno";
import { enviarEmailVerificacao } from "@/lib/email";
import { obterEscola } from "@/lib/escolas";
import { vincularContaAoConvite, type ConviteValido } from "@/lib/convites";

/** Convite ativo e dentro da validade para o código digitado (em qualquer formato), ou null. */
export async function buscarConviteValido(codigoDigitado: string): Promise<ConviteValido | null> {
  const codigo = normalizarCodigo(codigoDigitado);
  if (codigo.length !== 6) return null;
  const { data } = await supabase
    .from("convites_turma")
    .select("id, codigo, escola_id, turma_nome, ano_letivo, expira_em, ativo, escolas(nome)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!data || !data.ativo) return null;
  if (data.expira_em && new Date(data.expira_em) < new Date()) return null;
  const escola = data.escolas as unknown as { nome: string } | null;
  return {
    id: data.id,
    codigo: data.codigo,
    escola_id: data.escola_id,
    escola_nome: escola?.nome ?? "",
    turma_nome: data.turma_nome,
    ano_letivo: data.ano_letivo,
  };
}

/** Aluno já logado digita um código novo para entrar em outra turma. */
export async function entrarEmTurmaComCodigo(formData: FormData): Promise<void> {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const convite = await buscarConviteValido(String(formData.get("codigo") ?? ""));
  if (!convite || convite.escola_id !== aluno.escola_id) redirect("/aluno?erro=codigo");
  await vincularContaAoConvite(aluno.id, convite);
  redirect("/aluno?turma=ok");
}

export async function cadastrarAlunoComCodigo(formData: FormData): Promise<void> {
  const codigo = String(formData.get("codigo") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = normalizarIdentificador(String(formData.get("email") ?? ""));
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmarSenha") ?? "");
  const voltar = (erro: string) => redirect(`/aluno/entrar-com-codigo?codigo=${encodeURIComponent(codigo)}&erro=${erro}`);

  const convite = await buscarConviteValido(codigo);
  if (!convite) redirect("/aluno/entrar-com-codigo?erro=codigo");
  if (!nome || !email.includes("@")) voltar("campos");
  if (senha.length < 6) voltar("curta");
  if (senha !== confirmar) voltar("confirmacao");

  const [{ data: professor }, { data: existente }] = await Promise.all([
    supabase.from("professores").select("id").eq("email", email).maybeSingle(),
    supabase.from("alunos_contas").select("id, email_verificado, criado_via, escola_id").eq("email", email).maybeSingle(),
  ]);
  // So reaproveita conta de convite ainda nao confirmada, da mesma escola; qualquer outra e duplicada.
  const reaproveitavel = existente?.criado_via === "convite" && !existente.email_verificado && existente.escola_id === convite.escola_id;
  if (professor || (existente && !reaproveitavel)) voltar("duplicado");

  const token = randomBytes(32).toString("hex");
  const dados = {
    escola_id: convite.escola_id,
    nome,
    email,
    senha_hash: await bcrypt.hash(senha, 10),
    email_verificado: false,
    token_verificacao: token,
    token_verificacao_expira: new Date(Date.now() + 86_400_000).toISOString(),
    criado_via: "convite" as const,
  };
  // Cadastro repetido sem confirmar o email: reaproveita a conta e manda novo link.
  const { data: conta, error } = existente
    ? await supabase.from("alunos_contas").update(dados).eq("id", existente.id).select("id").single()
    : await supabase.from("alunos_contas").insert(dados).select("id").single();
  if (error || !conta) voltar("falha");

  await vincularContaAoConvite(conta!.id, convite);

  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verificar-email?token=${token}`;
  try {
    await enviarEmailVerificacao(email, nome, link, await obterEscola(convite.escola_id));
  } catch {
    voltar("email");
  }
  redirect("/aluno/entrar-com-codigo?enviado=1");
}
