"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirProfessor, podeVerQuestao } from "@/lib/questoes/acesso";
import { LIMITE_LOTE, nomeNormalizado, type ItemLote, type Recusa } from "@/lib/questoes/classificacao";
import {
  classificacaoDasQuestoes, classificarQuestoesPor, erro, criarHabilidadePor, juntarHabilidades, juntarTopicos,
  listarHabilidades, listarTopicos, proporTopicoPor, questoesParaClassificar,
} from "@/lib/questoes/classificacao-servidor";
import type { Area, Habilidade, MaterialRevisao, Questao, Topico } from "@/lib/types";

const AREAS: Area[] = ["linguagens", "humanas", "natureza", "matematica"];

async function exigirDono() {
  const professor = await exigirProfessor();
  if (professor.role !== "dono") throw new Error("Só o dono da plataforma gerencia a classificação.");
  return professor;
}

function atualizar() {
  revalidatePath("/banco", "layout");
}

const falhar = erro;

// ---------- leitura (qualquer professor) ----------

export async function listarTopicosAction(assuntoIds?: string[]): Promise<Topico[]> {
  await exigirProfessor();
  return listarTopicos(assuntoIds);
}

export async function listarHabilidadesAction(area?: Area): Promise<Habilidade[]> {
  await exigirProfessor();
  if (area && !AREAS.includes(area)) throw new Error("Área inválida.");
  return listarHabilidades(area);
}

export async function classificacaoDasQuestoesAction(
  ids: string[],
): Promise<Record<string, { topicoId: string | null; habilidadeIds: string[] }>> {
  const professor = await exigirProfessor();
  const visiveis = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("questoes").select("id, escopo, escola_id, status, criado_por").in("id", ids.slice(i, i + 100));
    falhar(error);
    for (const q of data ?? []) if (podeVerQuestao(professor, q)) visiveis.add(q.id);
  }
  return Object.fromEntries(await classificacaoDasQuestoes([...visiveis]));
}

export async function questoesParaClassificarAction(
  f: { materia?: string; assuntoId?: string; soSemTopico: boolean; limite: number; depoisDe?: string },
): Promise<{ questoes: Questao[]; total: number; classificadas: number }> {
  return questoesParaClassificar(await exigirProfessor(), f);
}

export async function listarPrerequisitosAction(topicoIds: string[]): Promise<{ topico_id: string; prerequisito_id: string }[]> {
  await exigirProfessor();
  if (topicoIds.length === 0) return [];
  const { data, error } = await supabase.from("topico_prerequisitos").select("topico_id, prerequisito_id").in("topico_id", topicoIds.slice(0, 500));
  falhar(error);
  return data ?? [];
}

export async function listarMateriaisAction(alvo: { topicoId?: string; assuntoId?: string }): Promise<MaterialRevisao[]> {
  const professor = await exigirProfessor();
  let q = supabase.from("materiais_revisao").select("*").order("created_at");
  if (alvo.topicoId) q = q.eq("topico_id", alvo.topicoId);
  else if (alvo.assuntoId) q = q.eq("assunto_id", alvo.assuntoId);
  else throw new Error("Informe o tópico ou o assunto.");
  const { data, error } = await q;
  falhar(error);
  return (data ?? []).filter((m) => m.escola_id === null || professor.role === "dono" || m.escola_id === professor.escola_id);
}

// ---------- classificar (qualquer professor, só nas questões que pode editar) ----------

export async function classificarQuestoes(
  itens: ItemLote[],
  modo: "adicionar" | "trocar",
): Promise<{ salvas: number; recusados: Recusa[] }> {
  const professor = await exigirProfessor();
  if (itens.length > LIMITE_LOTE) throw new Error(`No máximo ${LIMITE_LOTE} questões por vez.`);
  const r = await classificarQuestoesPor(professor, itens, modo);
  atualizar();
  return r;
}

export async function proporTopico(assuntoId: string, nome: string): Promise<Topico> {
  const t = await proporTopicoPor(await exigirProfessor(), assuntoId, nome);
  atualizar();
  return t;
}

// ---------- gerenciar (só dono) ----------

export async function criarHabilidade(area: Area, descricao: string, codigo: string | null): Promise<Habilidade> {
  const dono = await exigirDono();
  if (!AREAS.includes(area)) throw new Error("Área inválida.");
  const h = await criarHabilidadePor(dono, area, descricao, codigo, "aprovado");
  atualizar();
  return h;
}

export async function aprovarTopico(id: string): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("topicos").update({ situacao: "aprovado" }).eq("id", id);
  falhar(error);
  atualizar();
}

export async function renomearTopico(id: string, nome: string): Promise<void> {
  await exigirDono();
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) throw new Error("Informe o nome do tópico.");
  const { data: atual } = await supabase.from("topicos").select("assunto_id").eq("id", id).maybeSingle();
  if (!atual) throw new Error("Tópico não encontrado.");
  const { data: irmaos } = await supabase.from("topicos").select("id, nome").eq("assunto_id", atual.assunto_id);
  if ((irmaos ?? []).some((t) => t.id !== id && nomeNormalizado(t.nome) === nomeNormalizado(limpo))) {
    throw new Error("Já existe um tópico com esse nome neste assunto.");
  }
  const { error } = await supabase.from("topicos").update({ nome: limpo }).eq("id", id);
  falhar(error);
  atualizar();
}

export async function juntarTopicosAction(deId: string, paraId: string): Promise<void> {
  await exigirDono();
  await juntarTopicos(deId, paraId);
  atualizar();
}

export async function aprovarHabilidade(id: string): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("habilidades").update({ situacao: "aprovado" }).eq("id", id);
  falhar(error);
  atualizar();
}

export async function renomearHabilidade(id: string, descricao: string, codigo: string | null): Promise<void> {
  await exigirDono();
  const desc = descricao.trim().replace(/\s+/g, " ");
  if (!desc) throw new Error("Informe a descrição da habilidade.");
  const { error } = await supabase.from("habilidades").update({ descricao: desc, codigo: codigo?.trim() || null }).eq("id", id);
  falhar(error);
  atualizar();
}

export async function juntarHabilidadesAction(deId: string, paraId: string): Promise<void> {
  await exigirDono();
  await juntarHabilidades(deId, paraId);
  atualizar();
}

/** Troca os pré-requisitos do tópico pelos informados (do mesmo assunto não é exigido; sem laço consigo mesmo). */
export async function definirPrerequisitos(topicoId: string, prerequisitoIds: string[]): Promise<void> {
  await exigirDono();
  const ids = [...new Set(prerequisitoIds)];
  if (ids.includes(topicoId)) throw new Error("Um tópico não pode ser pré-requisito de si mesmo.");
  if (ids.length > 0) {
    const { data } = await supabase.from("topicos").select("id").in("id", [...ids, topicoId]);
    if ((data ?? []).length !== ids.length + 1) throw new Error("Tópico não encontrado.");
    // Evita ciclo direto: nenhum dos pré-requisitos pode depender deste tópico.
    const { data: inverso } = await supabase.from("topico_prerequisitos").select("topico_id").eq("prerequisito_id", topicoId).in("topico_id", ids);
    if ((inverso ?? []).length > 0) throw new Error("Esse pré-requisito já depende deste tópico.");
  }
  const { error: e1 } = await supabase.from("topico_prerequisitos").delete().eq("topico_id", topicoId);
  falhar(e1);
  if (ids.length > 0) {
    const { error } = await supabase.from("topico_prerequisitos").insert(ids.map((prerequisito_id) => ({ topico_id: topicoId, prerequisito_id })));
    falhar(error);
  }
  atualizar();
}

/** Material de um tópico OU de um assunto: uma aula OU título + link https. */
export async function adicionarMaterial(m: {
  topicoId?: string; assuntoId?: string; aulaId?: string; titulo?: string; url?: string;
}): Promise<void> {
  await exigirDono();
  if (!!m.topicoId === !!m.assuntoId) throw new Error("Escolha um tópico ou um assunto.");
  const titulo = m.titulo?.trim() || null;
  const url = m.url?.trim() || null;
  if (!m.aulaId) {
    if (!titulo) throw new Error("Informe o título do material.");
    if (!url || !url.startsWith("https://")) throw new Error("O link precisa começar com https://.");
  }
  const { error } = await supabase.from("materiais_revisao").insert({
    topico_id: m.topicoId ?? null,
    assunto_id: m.assuntoId ?? null,
    aula_id: m.aulaId ?? null,
    titulo: m.aulaId ? null : titulo,
    url: m.aulaId ? null : url,
    escola_id: null,
  });
  falhar(error);
  atualizar();
}

export async function removerMaterial(id: string): Promise<void> {
  await exigirDono();
  const { error } = await supabase.from("materiais_revisao").delete().eq("id", id);
  falhar(error);
  atualizar();
}
