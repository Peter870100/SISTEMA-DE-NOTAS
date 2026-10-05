"use server";

import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { getProfessorAtual } from "@/lib/auth";
import { ESCOLA_PADRAO_ID } from "@/lib/escolas";
import { urlDaEscola, validarSubdominio } from "@/lib/dominio";
import { normalizarHex, validarCores } from "@/lib/marca";

const BUCKET = "marcas";
const TIPOS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

async function exigirDono() {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") throw new Error("Só o dono da plataforma acessa o painel.");
  return p;
}

export type DadosEscola = { nome: string; nome_remetente_email: string; slogan: string; cor_principal: string; cor_destaque: string; codigo_convite_professor: string };
export type ResumoEscola = { id: string; nome: string; slug: string; ativa: boolean; professores: number; turmas: number; contas: number };

function limpar(d: DadosEscola) {
  const nome = String(d.nome ?? "").trim();
  const remetente = String(d.nome_remetente_email ?? "").trim() || nome;
  const codigo = String(d.codigo_convite_professor ?? "").trim();
  if (!nome) throw new Error("Informe o nome da escola.");
  if (codigo.length < 4 || codigo.length > 50) throw new Error("O código de convite precisa ter de 4 a 50 caracteres.");
  const crua_p = String(d.cor_principal ?? "").trim() || null;
  const crua_d = String(d.cor_destaque ?? "").trim() || null;
  const cores = validarCores(crua_p, crua_d);
  if (cores.erro) throw new Error(cores.erro);
  const cor_principal = crua_p ? normalizarHex(crua_p) : null;
  const cor_destaque = crua_d ? normalizarHex(crua_d) : null;
  return { nome: nome.slice(0, 120), nome_remetente_email: remetente.slice(0, 120), slogan: String(d.slogan ?? "").trim().slice(0, 160) || null, cor_principal, cor_destaque, codigo_convite_professor: codigo };
}

async function contar(tabela: "professores" | "alunos_contas", escolaId: string): Promise<number> {
  const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true }).eq("escola_id", escolaId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listarEscolas(): Promise<ResumoEscola[]> {
  await exigirDono();
  const { data, error } = await supabase.from("escolas").select("id, nome, slug, ativa").order("nome");
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(async (e) => {
    const [professores, contas, { data: turmas, error: e2 }] = await Promise.all([
      contar("professores", e.id),
      contar("alunos_contas", e.id),
      supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", e.id).limit(5000),
    ]);
    if (e2) throw new Error(e2.message);
    return { ...e, professores, contas, turmas: new Set((turmas ?? []).map((t) => `${t.nome}|${t.ano_letivo}`)).size };
  }));
}

export async function gerarCodigoConvite(): Promise<string> {
  await exigirDono();
  return String(randomInt(100000, 1000000));
}

export async function criarEscola(slug: string, d: DadosEscola, admin: { nome: string; email: string }) {
  await exigirDono();
  const s = String(slug ?? "").trim();
  const erroSlug = validarSubdominio(s);
  if (erroSlug) throw new Error(erroSlug);
  const campos = limpar(d);
  const nomeAdmin = String(admin?.nome ?? "").trim();
  const email = String(admin?.email ?? "").trim().toLowerCase();
  if (!nomeAdmin || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe nome e e-mail válidos do primeiro admin.");
  const [{ data: jaSlug }, { data: jaProf }, { data: jaAluno }] = await Promise.all([
    supabase.from("escolas").select("id").eq("slug", s).maybeSingle(),
    supabase.from("professores").select("id").eq("email", email).maybeSingle(),
    supabase.from("alunos_contas").select("id").eq("email", email).maybeSingle(),
  ]);
  if (jaSlug) throw new Error("Esse endereço já está em uso.");
  if (jaProf || jaAluno) throw new Error("Esse e-mail já tem conta na plataforma.");
  const { data: escola, error } = await supabase.from("escolas").insert({ ...campos, slug: s, logo_url: "", ativa: true }).select("id").single();
  if (error?.code === "23505") throw new Error("Esse endereço já está em uso.");
  if (error || !escola) throw new Error(error?.message ?? "Falha ao criar a escola.");
  const senhaProvisoria = randomBytes(6).toString("base64url");
  const { error: e2 } = await supabase.from("professores").insert({
    nome: nomeAdmin, email, senha_hash: await bcrypt.hash(senhaProvisoria, 10), role: "admin",
    email_verificado: true, senha_provisoria: true, escola_id: escola.id,
  });
  if (e2) {
    await supabase.from("escolas").delete().eq("id", escola.id);
    throw new Error(e2.code === "23505" ? "Esse e-mail já tem conta na plataforma." : e2.message);
  }
  return { escolaId: escola.id, senhaProvisoria };
}

export async function salvarEscola(id: string, d: DadosEscola): Promise<void> {
  await exigirDono();
  const { data, error } = await supabase.from("escolas").update(limpar(d)).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Escola não encontrada.");
}

export async function definirEscolaAtiva(id: string, ativa: boolean): Promise<void> {
  await exigirDono();
  if (id === ESCOLA_PADRAO_ID && !ativa) throw new Error("O Colégio Status não pode ser desativado.");
  const { data, error } = await supabase.from("escolas").update({ ativa: Boolean(ativa) }).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Escola não encontrada.");
}

export async function urlEnvioMarca(escolaId: string, tipo: "logo" | "login", tipoArquivo: string, tamanho: number) {
  await exigirDono();
  if (tipo !== "logo" && tipo !== "login") throw new Error("Tipo inválido.");
  const ext = TIPOS[tipoArquivo as keyof typeof TIPOS];
  if (!ext) throw new Error("Envie PNG, JPG ou WebP.");
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > 2 * 1024 * 1024) throw new Error("A imagem pode ter no máximo 2 MB.");
  const { data: escola } = await supabase.from("escolas").select("id").eq("id", escolaId).maybeSingle();
  if (!escola) throw new Error("Escola não encontrada.");
  const caminho = `${escola.id}/${tipo}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar o envio.");
  return { caminho, token: data.token, url: data.signedUrl };
}

export async function confirmarMarca(escolaId: string, tipo: "logo" | "login", caminho: string): Promise<void> {
  await exigirDono();
  if (tipo !== "logo" && tipo !== "login") throw new Error("Tipo inválido.");
  const { data: escola } = await supabase.from("escolas").select("id").eq("id", escolaId).maybeSingle();
  if (!escola) throw new Error("Escola não encontrada.");
  if (!new RegExp(`^${escola.id}/${tipo}-[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(String(caminho ?? ""))) throw new Error("Arquivo inválido.");
  const url = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  const { error } = await supabase.from("escolas").update(tipo === "logo" ? { logo_url: url } : { foto_login_url: url }).eq("id", escola.id);
  if (error) throw new Error(error.message);
}

export async function verificarEndereco(escolaId: string): Promise<boolean> {
  await exigirDono();
  const { data: e } = await supabase.from("escolas").select("slug").eq("id", escolaId).maybeSingle();
  if (!e) return false;
  try {
    const r = await fetch(urlDaEscola(e.slug, "/login"), { redirect: "manual", signal: AbortSignal.timeout(5000), cache: "no-store" });
    return r.status >= 200 && r.status < 400;
  } catch {
    return false;
  }
}
