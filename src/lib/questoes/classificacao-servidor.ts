import { supabase } from "@/lib/supabase/client";
import { ehAdmin } from "@/lib/papeis";
import type { Area, Habilidade, Questao, Topico } from "@/lib/types";
import type { Ator } from "./regras";
import {
  habilidadesFinais, nomeNormalizado, planoJuntarTopicos, validarItens,
  type ItemLote, type QuestaoLote, type Recusa,
} from "./classificacao";

// Leitura e gravação da classificação fina. Recebem o Ator; nunca leem a sessão.

const BLOCO = 100;

function emBlocos<T>(lista: T[], tamanho = BLOCO): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho));
  return saida;
}

function erro(e: { message: string } | null, padrao = "Falha ao gravar."): void {
  if (e) {
    if (e.message.includes("uq_topicos")) throw new Error("Já existe um tópico com esse nome neste assunto.");
    if (e.message.includes("uq_habilidades_area_descricao")) throw new Error("Já existe uma habilidade com essa descrição nesta área.");
    if (e.message.includes("uq_habilidades_area_codigo")) throw new Error("Já existe uma habilidade com esse código nesta área.");
    throw new Error(e.message || padrao);
  }
}

// ---------- leitura ----------

export async function listarTopicos(assuntoIds?: string[]): Promise<Topico[]> {
  if (assuntoIds) {
    const saida: Topico[] = [];
    for (const bloco of emBlocos([...new Set(assuntoIds)])) {
      const { data, error } = await supabase.from("topicos").select("*").in("assunto_id", bloco).order("nome");
      erro(error);
      saida.push(...(data ?? []));
    }
    return saida;
  }
  const { data, error } = await supabase.from("topicos").select("*").order("nome").limit(5000);
  erro(error);
  return data ?? [];
}

export async function listarHabilidades(area?: Area): Promise<Habilidade[]> {
  let q = supabase.from("habilidades").select("*").order("area").order("codigo", { nullsFirst: false }).order("descricao");
  if (area) q = q.eq("area", area);
  const { data, error } = await q.limit(5000);
  erro(error);
  return data ?? [];
}

export async function classificacaoDasQuestoes(
  ids: string[],
): Promise<Map<string, { topicoId: string | null; habilidadeIds: string[] }>> {
  const mapa = new Map<string, { topicoId: string | null; habilidadeIds: string[] }>();
  for (const bloco of emBlocos([...new Set(ids)])) {
    const [{ data: qs, error: e1 }, { data: hs, error: e2 }] = await Promise.all([
      supabase.from("questoes").select("id, topico_id").in("id", bloco),
      supabase.from("questao_habilidades").select("questao_id, habilidade_id").in("questao_id", bloco).limit(10000),
    ]);
    erro(e1);
    erro(e2);
    for (const q of qs ?? []) mapa.set(q.id, { topicoId: q.topico_id ?? null, habilidadeIds: [] });
    for (const h of hs ?? []) mapa.get(h.questao_id)?.habilidadeIds.push(h.habilidade_id);
  }
  return mapa;
}

/** Questões que o ator pode editar, para classificar (paginação por id). */
export async function questoesParaClassificar(
  ator: Ator,
  f: { materia?: string; assuntoId?: string; soSemTopico: boolean; limite: number; depoisDe?: string },
): Promise<{ questoes: Questao[]; total: number; classificadas: number }> {
  const base = (cabeca: boolean) => {
    let q = supabase.from("questoes").select("*", cabeca ? { count: "exact", head: true } : undefined);
    if (ator.role !== "dono") {
      q = q.eq("escopo", "escola").eq("escola_id", ator.escola_id);
      if (!ehAdmin(ator.role)) q = q.eq("criado_por", ator.id);
    }
    if (f.materia) q = q.eq("materia", f.materia);
    if (f.assuntoId) q = q.eq("assunto_id", f.assuntoId);
    return q;
  };
  // Só há o que classificar quando a questão tem assunto.
  const comAssunto = <T extends { not: (c: string, o: string, v: unknown) => T }>(q: T) => q.not("assunto_id", "is", null);

  let lista = comAssunto(base(false));
  if (f.soSemTopico) lista = lista.is("topico_id", null);
  if (f.depoisDe) lista = lista.gt("id", f.depoisDe);
  const limite = Math.max(1, Math.min(f.limite, 200));
  const [{ data, error: e1 }, totalR, classR] = await Promise.all([
    lista.order("id").limit(limite),
    comAssunto(base(true)),
    comAssunto(base(true)).not("topico_id", "is", null),
  ]);
  erro(e1);
  erro(totalR.error);
  erro(classR.error);
  return { questoes: (data ?? []) as Questao[], total: totalR.count ?? 0, classificadas: classR.count ?? 0 };
}

// ---------- gravação ----------

export async function classificarQuestoesPor(
  ator: Ator,
  itens: ItemLote[],
  modo: "adicionar" | "trocar",
): Promise<{ salvas: number; recusados: Recusa[] }> {
  const questaoIds = [...new Set(itens.map((i) => i.questaoId))];
  const topicoIds = [...new Set(itens.map((i) => i.topicoId).filter((t): t is string => !!t))];
  const habIds = [...new Set(itens.flatMap((i) => i.habilidadeIds ?? []))];

  const questoes = new Map<string, QuestaoLote>();
  for (const bloco of emBlocos(questaoIds)) {
    const { data, error } = await supabase.from("questoes").select("id, assunto_id, area, escopo, escola_id, criado_por").in("id", bloco);
    erro(error);
    for (const q of data ?? []) questoes.set(q.id, q as QuestaoLote);
  }
  const topicos = new Map<string, { assunto_id: string }>();
  for (const bloco of emBlocos(topicoIds)) {
    const { data, error } = await supabase.from("topicos").select("id, assunto_id").in("id", bloco);
    erro(error);
    for (const t of data ?? []) topicos.set(t.id, t);
  }
  const habilidades = new Map<string, { area: Area }>();
  for (const bloco of emBlocos(habIds)) {
    const { data, error } = await supabase.from("habilidades").select("id, area").in("id", bloco);
    erro(error);
    for (const h of data ?? []) habilidades.set(h.id, { area: h.area as Area });
  }

  const { aceitos, recusados } = validarItens(itens, questoes, topicos, habilidades, ator);
  if (aceitos.length === 0) return { salvas: 0, recusados };

  // Tópico: um update por tópico (null limpa). Itens sem a chave `topicoId` não mexem no tópico.
  const porTopico = new Map<string | null, string[]>();
  for (const item of aceitos) {
    if (item.topicoId === undefined) continue;
    const chave = item.topicoId || null;
    porTopico.set(chave, [...(porTopico.get(chave) ?? []), item.questaoId]);
  }
  for (const [topicoId, ids] of porTopico) {
    for (const bloco of emBlocos(ids)) {
      const { error } = await supabase.from("questoes").update({ topico_id: topicoId }).in("id", bloco);
      erro(error);
    }
  }

  // Habilidades: apaga e insere as finais por questão. Itens sem `habilidadeIds` não mexem nelas.
  const comHab = aceitos.filter((i) => i.habilidadeIds !== undefined);
  if (comHab.length > 0) {
    const atuais = modo === "adicionar" ? await classificacaoDasQuestoes(comHab.map((i) => i.questaoId)) : new Map<string, { habilidadeIds: string[] }>();
    const linhas: { questao_id: string; habilidade_id: string }[] = [];
    for (const item of comHab) {
      const finais = habilidadesFinais(atuais.get(item.questaoId)?.habilidadeIds ?? [], item.habilidadeIds ?? [], modo);
      for (const habilidade_id of finais) linhas.push({ questao_id: item.questaoId, habilidade_id });
    }
    for (const bloco of emBlocos(comHab.map((i) => i.questaoId))) {
      const { error } = await supabase.from("questao_habilidades").delete().in("questao_id", bloco);
      erro(error);
    }
    for (const bloco of emBlocos(linhas, 500)) {
      const { error } = await supabase.from("questao_habilidades").insert(bloco);
      erro(error);
    }
  }
  return { salvas: aceitos.length, recusados };
}

/** Propõe um tópico; se o nome (normalizado) já existe no assunto, devolve o existente. */
export async function proporTopicoPor(ator: Ator, assuntoId: string, nome: string): Promise<Topico> {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) throw new Error("Informe o nome do tópico.");
  if (limpo.length > 120) throw new Error("O nome do tópico é muito longo.");
  const { data: assunto } = await supabase.from("assuntos").select("id").eq("id", assuntoId).maybeSingle();
  if (!assunto) throw new Error("Assunto não encontrado.");
  const procurar = async () => {
    const { data, error } = await supabase.from("topicos").select("*").eq("assunto_id", assuntoId);
    erro(error);
    return (data ?? []).find((t) => nomeNormalizado(t.nome) === nomeNormalizado(limpo)) ?? null;
  };
  const existente = await procurar();
  if (existente) return existente;
  const { data, error } = await supabase
    .from("topicos")
    .insert({ assunto_id: assuntoId, nome: limpo, situacao: ator.role === "dono" ? "aprovado" : "proposto" })
    .select("*")
    .single();
  if (error || !data) {
    const corrida = await procurar(); // outro pedido criou ao mesmo tempo
    if (corrida) return corrida;
    erro(error, "Falha ao criar o tópico.");
    throw new Error("Falha ao criar o tópico.");
  }
  return data;
}

/** Só o dono cria habilidades. */
export async function criarHabilidadePor(
  ator: Ator,
  area: Area,
  descricao: string,
  codigo: string | null,
  situacao: "aprovado" | "proposto",
): Promise<Habilidade> {
  if (ator.role !== "dono") throw new Error("Só o dono da plataforma cria habilidades.");
  const desc = descricao.trim().replace(/\s+/g, " ");
  if (!desc) throw new Error("Informe a descrição da habilidade.");
  const cod = codigo?.trim() || null;
  const { data, error } = await supabase.from("habilidades").insert({ area, descricao: desc, codigo: cod, situacao }).select("*").single();
  if (error || !data) {
    erro(error, "Falha ao criar a habilidade.");
    throw new Error("Falha ao criar a habilidade.");
  }
  return data;
}

// ---------- junções ----------

/** Troca `de` por `para` nos pré-requisitos (sem repetir a chave nem criar laço) e nos materiais; não apaga `de`. */
async function transferirTopico(deId: string, paraId: string): Promise<void> {
  const { data: pre, error: e1 } = await supabase
    .from("topico_prerequisitos").select("topico_id, prerequisito_id")
    .or(`topico_id.eq.${deId},prerequisito_id.eq.${deId}`);
  erro(e1);
  const novas = (pre ?? [])
    .map((p) => ({
      topico_id: p.topico_id === deId ? paraId : p.topico_id,
      prerequisito_id: p.prerequisito_id === deId ? paraId : p.prerequisito_id,
    }))
    .filter((p) => p.topico_id !== p.prerequisito_id);
  if (novas.length > 0) {
    const { error } = await supabase.from("topico_prerequisitos").upsert(novas, { onConflict: "topico_id,prerequisito_id", ignoreDuplicates: true });
    erro(error);
  }
  const { error: e3 } = await supabase.from("materiais_revisao").update({ topico_id: paraId }).eq("topico_id", deId);
  erro(e3);
}

/** Junta dois tópicos do mesmo assunto: move questões, pré-requisitos e materiais e apaga o `de`. */
export async function juntarTopicos(deId: string, paraId: string): Promise<void> {
  if (deId === paraId) throw new Error("Escolha outro tópico.");
  const { data } = await supabase.from("topicos").select("id, assunto_id").in("id", [deId, paraId]);
  const de = data?.find((t) => t.id === deId);
  const para = data?.find((t) => t.id === paraId);
  if (!de || !para) throw new Error("Tópico não encontrado.");
  if (de.assunto_id !== para.assunto_id) throw new Error("Os tópicos precisam ser do mesmo assunto.");
  const { error } = await supabase.from("questoes").update({ topico_id: paraId }).eq("topico_id", deId);
  erro(error);
  await transferirTopico(deId, paraId);
  const { error: e2 } = await supabase.from("topicos").delete().eq("id", deId);
  erro(e2);
}

/**
 * Parte "tópicos" de juntar assuntos. Roda ANTES de mudar `questoes.assunto_id` (o gatilho zera o
 * tópico que não é do assunto da questão): tópicos novos são movidos de assunto; os de nome igual
 * têm as questões levadas junto para o tópico do destino, no mesmo update que muda o assunto.
 */
export async function moverTopicosDoAssunto(origemId: string, destinoId: string): Promise<void> {
  const [{ data: o, error: e1 }, { data: d, error: e2 }] = await Promise.all([
    supabase.from("topicos").select("id, nome").eq("assunto_id", origemId),
    supabase.from("topicos").select("id, nome").eq("assunto_id", destinoId),
  ]);
  erro(e1);
  erro(e2);
  const plano = planoJuntarTopicos(o ?? [], d ?? []);
  for (const bloco of emBlocos(plano.mover)) {
    const { error } = await supabase.from("topicos").update({ assunto_id: destinoId }).in("id", bloco);
    erro(error);
  }
  for (const j of plano.juntar) {
    // Assunto e tópico mudam juntos: no estado final o gatilho vê um tópico do assunto da questão.
    const { error } = await supabase.from("questoes").update({ assunto_id: destinoId, topico_id: j.para }).eq("topico_id", j.de);
    erro(error);
    await transferirTopico(j.de, j.para);
    const { error: e3 } = await supabase.from("topicos").delete().eq("id", j.de);
    erro(e3);
  }
  const { error: e4 } = await supabase.from("materiais_revisao").update({ assunto_id: destinoId }).eq("assunto_id", origemId);
  erro(e4);
}

/** Junta duas habilidades da mesma área: as questões passam para o `para` e o `de` é apagado. */
export async function juntarHabilidades(deId: string, paraId: string): Promise<void> {
  if (deId === paraId) throw new Error("Escolha outra habilidade.");
  const { data } = await supabase.from("habilidades").select("id, area").in("id", [deId, paraId]);
  const de = data?.find((h) => h.id === deId);
  const para = data?.find((h) => h.id === paraId);
  if (!de || !para) throw new Error("Habilidade não encontrada.");
  if (de.area !== para.area) throw new Error("As habilidades precisam ser da mesma área.");
  const { data: links, error } = await supabase.from("questao_habilidades").select("questao_id").eq("habilidade_id", deId).limit(100000);
  erro(error);
  const novas = (links ?? []).map((l) => ({ questao_id: l.questao_id, habilidade_id: paraId }));
  for (const bloco of emBlocos(novas, 500)) {
    const { error: e2 } = await supabase.from("questao_habilidades").upsert(bloco, { onConflict: "questao_id,habilidade_id", ignoreDuplicates: true });
    erro(e2);
  }
  const { error: e3 } = await supabase.from("habilidades").delete().eq("id", deId);
  erro(e3);
}
