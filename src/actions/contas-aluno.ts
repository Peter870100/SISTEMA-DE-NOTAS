"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { exigirAdminDaEscola, exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { mesmaEscola } from "@/lib/escola-regras";
import { normalizarCodigo } from "@/lib/codigo-convite";
import { gerarSenhaProvisoria, normalizarIdentificador, sugerirUsuario } from "@/lib/contas-aluno";
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
export type CredencialGerada = { nome: string; usuario: string; senha: string; turma: string };

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

/** Usuários já tomados que começam igual aos sugeridos — para o sufixo numérico não colidir. */
async function usuariosExistentes(bases: string[]): Promise<Set<string>> {
  const prefixos = [...new Set(bases.map((b) => b.replace(/\d+$/, "")))];
  const existentes = new Set<string>();
  for (const prefixo of prefixos) {
    const { data } = await supabase.from("alunos_contas").select("usuario").ilike("usuario", `${prefixo}%`);
    for (const linha of data ?? []) if (linha.usuario) existentes.add(linha.usuario);
  }
  return existentes;
}

export async function prepararLote(nomes: string[]): Promise<{ nome: string; usuario: string }[]> {
  await exigirAdminDaEscola();
  const limpos = nomes.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  const existentes = await usuariosExistentes(limpos.map((n) => sugerirUsuario(n, new Set())));
  return limpos.map((nome) => ({ nome, usuario: sugerirUsuario(nome, existentes) }));
}

export async function criarContasAluno(turmaId: string, alunos: { nome: string; usuario: string }[]): Promise<CredencialGerada[]> {
  const admin = await exigirAdminDaEscola();
  const turma = await exigirTurmaDaEscola(admin, turmaId).catch(() => null);
  if (!turma) throw new Error("Turma não encontrada.");

  // Valida tudo antes do primeiro insert, para não perder senhas de contas já criadas.
  const invalidos: string[] = [];
  const vistos = new Set<string>();
  for (const { nome, usuario } of alunos) {
    const u = usuario.trim().toLowerCase();
    if (!nome.trim() || !/^[a-z0-9.]+$/.test(u) || vistos.has(u)) invalidos.push(nome.trim() || "(sem nome)");
    vistos.add(u);
  }
  if (invalidos.length > 0) throw new Error(`Usuário inválido ou repetido para: ${invalidos.join(", ")}. Nenhuma conta foi criada.`);

  const credenciais: CredencialGerada[] = [];
  for (const { nome, usuario } of alunos) {
    const usuarioLimpo = usuario.trim().toLowerCase();
    const senha = gerarSenhaProvisoria();
    const { data: conta, error } = await supabase
      .from("alunos_contas")
      .insert({ escola_id: admin.escola_id, nome: nome.trim(), usuario: usuarioLimpo, senha_hash: await bcrypt.hash(senha, 10), senha_provisoria: true, criado_via: "escola" })
      .select("id")
      .single();
    if (error?.code === "23505") throw new Error(`O usuário ${usuarioLimpo} já existe. Gere a prévia de novo. ${credenciais.length} conta(s) já foram criadas antes deste.`);
    if (error || !conta) throw new Error(error?.message ?? "Falha ao criar conta.");
    const { error: erroVinculo } = await supabase.from("aluno_turmas").insert({ conta_id: conta.id, escola_id: admin.escola_id, turma_nome: turma.nome, ano_letivo: turma.ano_letivo });
    if (erroVinculo) {
      await supabase.from("alunos_contas").delete().eq("id", conta.id);
      throw new Error(`Falha ao ligar ${nome.trim()} à turma. ${credenciais.length} conta(s) já foram criadas antes deste.`);
    }
    credenciais.push({ nome: nome.trim(), usuario: usuarioLimpo, senha, turma: `${turma.nome} · ${turma.ano_letivo}` });
  }
  return credenciais;
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
