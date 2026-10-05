"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirAdminDaEscola, exigirProfessorLogado } from "@/lib/escola-acesso";
import { mesmaEscola } from "@/lib/escola-regras";
import type { ItemLixeira, ResultadoRestauracao } from "@/lib/types";

const COLUNAS_EXIBICAO = "id, tipo, titulo, turma_id, turma_nome, resumo, excluido_por, excluido_via, excluido_em";

/** Janela em que o professor ainda pode desfazer a própria exclusão (Ctrl+Z) sem precisar do admin. */
const JANELA_DESFAZER_MS = 30 * 60 * 1000;

/**
 * Erros esperados voltam como valor, não como exceção: em produção o Next troca a mensagem
 * de exceções de server action por uma genérica, e aqui a mensagem é o que orienta o usuário
 * (ex.: "Restaure a planilha … primeiro").
 */
export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

export async function listarLixeira(): Promise<(ItemLixeira & { excluido_por_nome: string | null })[]> {
  const admin = await exigirAdminDaEscola();
  const { data, error } = await supabase
    .from("lixeira")
    .select(COLUNAS_EXIBICAO)
    .eq("escola_id", admin.escola_id)
    .order("excluido_em", { ascending: false });
  if (error) throw new Error(error.message);
  const itens = (data ?? []) as ItemLixeira[];

  const ids = [...new Set(itens.map((i) => i.excluido_por).filter((id): id is string => !!id))];
  const { data: professores } = ids.length
    ? await supabase.from("professores").select("id, nome").eq("escola_id", admin.escola_id).in("id", ids)
    : { data: [] as { id: string; nome: string }[] };
  const nomePorId = new Map((professores ?? []).map((p) => [p.id, p.nome]));

  return itens.map((i) => ({ ...i, excluido_por_nome: i.excluido_por ? nomePorId.get(i.excluido_por) ?? null : null }));
}

async function itemDaEscola(id: string, escolaId: string): Promise<boolean> {
  const { data: item } = await supabase.from("lixeira").select("id, escola_id").eq("id", id).maybeSingle();
  return !!item && mesmaEscola(item, escolaId);
}

async function restaurar(id: string): Promise<Resposta<ResultadoRestauracao>> {
  const { data, error } = await supabase.rpc("lixeira_restaurar", { p_lixeira_id: id });
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/lixeira");
  revalidatePath("/");
  if (data.turma_id) revalidatePath(`/turma/${data.turma_id}`);
  return { ok: true, dados: data };
}

export async function restaurarDaLixeira(id: string): Promise<Resposta<ResultadoRestauracao>> {
  const admin = await exigirAdminDaEscola();
  if (!(await itemDaEscola(id, admin.escola_id))) return { ok: false, erro: "Item não encontrado." };
  return restaurar(id);
}

export async function apagarDaLixeira(id: string): Promise<Resposta<null>> {
  const admin = await exigirAdminDaEscola();
  if (!(await itemDaEscola(id, admin.escola_id))) return { ok: false, erro: "Item não encontrado." };
  const { error } = await supabase.from("lixeira").delete().eq("id", id).eq("escola_id", admin.escola_id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/lixeira");
  return { ok: true, dados: null };
}

/** Ctrl+Z do professor: só a própria exclusão, feita pela tela, há no máximo 30 minutos. */
export async function desfazerExclusao(id: string): Promise<Resposta<ResultadoRestauracao>> {
  const professor = await exigirProfessorLogado().catch(() => null);
  if (!professor) return { ok: false, erro: "Faça login novamente." };
  const { data: item } = await supabase
    .from("lixeira")
    .select("id, escola_id, excluido_por, excluido_via, excluido_em")
    .eq("id", id)
    .maybeSingle();
  if (!item || !mesmaEscola(item, professor.escola_id)) return { ok: false, erro: "Este item não está mais na lixeira." };
  const dentroDaJanela = Date.now() - new Date(item.excluido_em).getTime() <= JANELA_DESFAZER_MS;
  if (item.excluido_por !== professor.id || item.excluido_via !== "app" || !dentroDaJanela) {
    return { ok: false, erro: "Não dá mais pra desfazer por aqui. Peça a um administrador para restaurar pela lixeira." };
  }
  return restaurar(id);
}
