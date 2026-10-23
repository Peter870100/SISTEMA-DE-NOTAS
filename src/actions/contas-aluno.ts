"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { exigirAdminDaEscola, exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { mesmaEscola } from "@/lib/escola-regras";
import { normalizarCodigo } from "@/lib/codigo-convite";
import { gerarSenhaProvisoria, normalizarIdentificador } from "@/lib/contas-aluno";
import {
  aplicarLigacoesPor,
  criarContasDaPlanilhaPor,
  criarContasNaTurma,
  ligarContaPor,
  previaContasDaPlanilhaPor,
  previaLigacoesPorNomePor,
  sugerirUsuarios,
  type CredencialGerada as Credencial,
  type LinhaPreviaPlanilha,
  type PreviaLigacoes,
} from "@/lib/contas/nucleo";
import { limparNome } from "@/lib/contas/ligacao";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { Professor } from "@/lib/types";
import { enviarEmailVerificacao } from "@/lib/email";
import { linkDaEscola, obterEscola } from "@/lib/escolas";
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

  const escolaDoConvite = await obterEscola(convite.escola_id);
  const link = linkDaEscola(escolaDoConvite, `/verificar-email?token=${token}`);
  try {
    await enviarEmailVerificacao(email, nome, link, escolaDoConvite);
  } catch {
    voltar("email");
  }
  redirect("/aluno/entrar-com-codigo?enviado=1");
}

export type ContaAlunoAdmin = { id: string; nome: string; usuario: string | null; email: string | null; ativo: boolean; ultimo_acesso: string | null; turmas: string[] };
export type CredencialGerada = Credencial;

async function contaDaMinhaEscola(contaId: string, escolaId: string): Promise<void> {
  const { data } = await supabase.from("alunos_contas").select("escola_id").eq("id", contaId).maybeSingle();
  if (!data || !mesmaEscola(data, escolaId)) throw new Error("Conta não encontrada.");
}

export async function listarContasAluno(): Promise<ContaAlunoAdmin[]> {
  const admin = await exigirAdminDaEscola();
  const [{ data: contas }, { data: vinculos }] = await Promise.all([
    supabase.from("alunos_contas").select("id, nome, usuario, email, ativo, ultimo_acesso").eq("escola_id", admin.escola_id).order("nome"),
    supabase.from("aluno_turmas").select("conta_id, turma_nome, ano_letivo").eq("escola_id", admin.escola_id),
  ]);
  const turmasPorConta = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    turmasPorConta.set(v.conta_id, [...(turmasPorConta.get(v.conta_id) ?? []), `${v.turma_nome} · ${v.ano_letivo}`]);
  }
  return (contas ?? []).map((c) => ({ ...c, turmas: turmasPorConta.get(c.id) ?? [] }));
}

export async function prepararLote(nomes: string[]): Promise<{ nome: string; usuario: string }[]> {
  await exigirAdminDaEscola();
  const limpos = nomes.map(limparNome).filter(Boolean);
  const usuarios = await sugerirUsuarios(limpos);
  return limpos.map((nome, i) => ({ nome, usuario: usuarios[i] }));
}

/** O admin logado (admin ou dono da escola) como ator do núcleo: vê todas as turmas da escola. */
function atorDoAdmin(admin: Professor): AtorEscola {
  return { id: admin.id, role: admin.role, escola_id: admin.escola_id, turmas: null, via: "app" };
}

async function atorAdmin(): Promise<AtorEscola> {
  return atorDoAdmin(await exigirAdminDaEscola());
}

export async function criarContasAluno(turmaId: string, alunos: { nome: string; usuario: string }[]): Promise<CredencialGerada[]> {
  const admin = await exigirAdminDaEscola();
  const turma = await exigirTurmaDaEscola(admin, turmaId).catch(() => null);
  if (!turma) throw new Error("Turma não encontrada.");
  return criarContasNaTurma(atorDoAdmin(admin), turma, alunos.map(({ nome, usuario }) => ({ nome, usuario })));
}

/** Alunos da planilha da turma (bimestre vigente) ainda sem conta ligada, com o usuário sugerido. */
export async function previaContasDaPlanilha(turmaId: string): Promise<LinhaPreviaPlanilha[]> {
  return previaContasDaPlanilhaPor(await atorAdmin(), turmaId);
}

/** Cria as contas com o nome da planilha e já ligadas; quem já tem conta ligada é ignorado (`ignorados`). */
export async function criarContasDaPlanilha(turmaId: string, linhas: { alunoId: string; usuario: string }[]): Promise<{ credenciais: CredencialGerada[]; ignorados: string[] }> {
  return criarContasDaPlanilhaPor(await atorAdmin(), turmaId, linhas.map(({ alunoId, usuario }) => ({ alunoId: String(alunoId), usuario: String(usuario) })));
}

/** Prévia de "Ligar pelo nome": só casamentos únicos dos dois lados; os repetidos são ligados à mão. */
export async function previaLigacoesPorNome(turmaId: string): Promise<PreviaLigacoes> {
  return previaLigacoesPorNomePor(await atorAdmin(), turmaId);
}

export async function aplicarLigacoes(turmaId: string, pares: { contaId: string; alunoId: string }[]): Promise<{ ligadas: number }> {
  return aplicarLigacoesPor(await atorAdmin(), turmaId, pares.map(({ contaId, alunoId }) => ({ contaId: String(contaId), alunoId: String(alunoId) })));
}

/** Liga a conta à mão a uma linha da planilha da turma, ou desliga só nesta turma com null. */
export async function ligarConta(contaId: string, turmaId: string, alunoId: string | null): Promise<void> {
  return ligarContaPor(await atorAdmin(), contaId, turmaId, alunoId);
}

export async function definirContaAtiva(contaId: string, ativo: boolean): Promise<void> {
  const admin = await exigirAdminDaEscola();
  await contaDaMinhaEscola(contaId, admin.escola_id);
  const { error } = await supabase.from("alunos_contas").update({ ativo }).eq("id", contaId);
  if (error) throw new Error(error.message);
}

export async function novaSenhaAlunoPeloAdmin(contaId: string): Promise<string> {
  const admin = await exigirAdminDaEscola();
  await contaDaMinhaEscola(contaId, admin.escola_id);
  const senha = gerarSenhaProvisoria();
  const { error } = await supabase.from("alunos_contas").update({ senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true, email_verificado: true }).eq("id", contaId);
  if (error) throw new Error(error.message);
  return senha;
}
