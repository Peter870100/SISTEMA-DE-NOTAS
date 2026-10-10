"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { enemDevParaQuestao, motivoSemClassificacao, urlImagemPermitida, type EnemDevQuestao } from "@/lib/questoes/enemdev";
import { inserirAssuntosIniciais } from "@/lib/questoes/assuntos-servidor";
import { clienteIA, custoDoUso, iaDisponivel, pedidoClassificacao, progressoDoLote } from "@/lib/questoes/ia";
import { ClassificacaoSchema, classificacaoParaAtualizacoes } from "@/lib/questoes/formato-ia";
import { BUCKET } from "@/lib/questoes/storage";
import type { StatusImportacao } from "@/lib/types";

const API = "https://api.enem.dev/v1";
const LOTE_DOWNLOAD = 25;
const POR_PEDIDO = 20;

async function exigirDono() {
  const p = await exigirProfessor();
  if (p.role !== "dono") throw new Error("Só o dono importa o ENEM.");
  return p;
}

export type PassoEnem = { importacaoId: string; feitas: number; total: number; terminou: boolean; status: StatusImportacao; semIA?: boolean; progresso?: number };

const MARCA_SEM_CLASSIFICACAO = "Matéria e assunto a classificar.";

/** Sem chave da IA: as questões sem assunto ficam em revisão com o aviso, para classificar depois. */
async function marcarSemClassificacao(importacaoId: string) {
  const { data } = await supabase.from("questoes").select("id, motivo_revisao").eq("importacao_id", importacaoId).is("assunto_id", null);
  for (const q of data ?? []) {
    if (q.motivo_revisao?.includes(MARCA_SEM_CLASSIFICACAO)) continue;
    const { error } = await supabase.from("questoes")
      .update({ precisa_revisao: true, motivo_revisao: [q.motivo_revisao, MARCA_SEM_CLASSIFICACAO].filter(Boolean).join(" ") })
      .eq("id", q.id);
    if (error) throw new Error(error.message);
  }
}

/** Reserva a importação (a partir do status `de`) e cria o lote de classificação; volta para `de` se falhar antes do lote existir. */
async function classificarAgora(importacaoId: string, de: StatusImportacao): Promise<boolean> {
  const { data: reservou } = await supabase.from("importacoes").update({ status: "lendo", batch_id: null, updated_at: new Date().toISOString() }).eq("id", importacaoId).eq("status", de).select("id");
  if (!reservou || reservou.length === 0) return false;
  try {
    await iniciarClassificacao(importacaoId);
  } catch (e) {
    // Depois que o lote (pago) existe, não volta o status: o batch_id não pode se perder.
    if (e instanceof LoteCriadoError) throw e;
    await supabase.from("importacoes").update({ status: de, batch_id: null, updated_at: new Date().toISOString() }).eq("id", importacaoId);
    throw e;
  }
  return true;
}

export async function criarImportacaoEnem(ano: number): Promise<string> {
  const dono = await exigirDono();
  if (!Number.isInteger(ano) || ano < 2009 || ano > 2023) throw new Error("Ano fora de 2009–2023.");
  const { data: existentes } = await supabase.from("importacoes").select("id, status").eq("origem", "enemdev").eq("ano", ano).neq("status", "concluida").order("created_at", { ascending: false }).limit(1);
  const existente = existentes?.[0];
  if (existente) return existente.id;
  const { data, error } = await supabase.from("importacoes")
    .insert({ escopo: "geral", escola_id: null, origem: "enemdev", banca: "ENEM", ano, caderno: "", status: "enviando", criado_por: dono.id })
    .select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar importação.");
  return data.id;
}

async function copiarImagem(url: string, questaoId: string): Promise<string | null> {
  try {
    if (!urlImagemPermitida(url)) return null;
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    if (Number(r.headers.get("content-length") ?? 0) > 5242880) return null;
    const tipo = r.headers.get("content-type") ?? "";
    const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : tipo.includes("jpeg") || tipo.includes("jpg") ? "jpg" : null;
    if (!ext) return null;
    const corpo = await r.arrayBuffer();
    if (corpo.byteLength > 5242880) return null;
    const caminho = `imagens/${questaoId}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, corpo, { contentType: tipo });
    return error ? null : caminho;
  } catch {
    return null;
  }
}

export async function avancarImportacaoEnem(importacaoId: string): Promise<PassoEnem> {
  await exigirDono();
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  if (!imp || imp.origem !== "enemdev") throw new Error("Importação não encontrada.");
  if (imp.status === "lendo") return atualizarClassificacaoEnem(importacaoId);
  if (imp.status === "revisao" && iaDisponivel()) {
    // Ano já baixado sem IA: agora que há chave, classifica o que ficou sem assunto.
    const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).is("assunto_id", null).eq("status", "revisao");
    if ((count ?? 0) > 0) {
      await classificarAgora(importacaoId, "revisao");
      return { importacaoId, feitas: imp.paginas_lidas, total: imp.total_paginas, terminou: false, status: "lendo" };
    }
  }
  if (imp.status !== "enviando") return { importacaoId, feitas: imp.paginas_lidas, total: imp.total_paginas, terminou: true, status: imp.status, semIA: imp.status === "revisao" && !iaDisponivel() };

  const offset = imp.paginas_lidas;
  const r = await fetch(`${API}/exams/${imp.ano}/questions?limit=${LOTE_DOWNLOAD}&offset=${offset}`, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`O enem.dev respondeu ${r.status}. Tente de novo em instantes.`);
  const corpo = (await r.json()) as { metadata: { total: number; hasMore: boolean }; questions: EnemDevQuestao[] };

  for (const q of corpo.questions) {
    const { linha, imagens } = enemDevParaQuestao(q);
    const { data: criada, error } = await supabase.from("questoes").insert({ ...linha, precisa_revisao: true, importacao_id: importacaoId, criado_por: imp.criado_por }).select("id").single();
    if (error) {
      if (error.message.includes("uq_questoes")) continue; // já existe: pula
      throw new Error(error.message);
    }
    // A questão fica marcada para revisão enquanto as imagens são copiadas; se a função for interrompida, não sai limpa.
    let falhou = false;
    for (const [i, img] of imagens.entries()) {
      const caminho = await copiarImagem(img.url, criada.id);
      if (!caminho) { falhou = true; continue; }
      const { error: erroImg } = await supabase.from("questao_imagens").insert({ questao_id: criada.id, alvo: img.alvo, ordem: i, tipo: "arquivo", storage_path: caminho });
      if (erroImg) falhou = true;
    }
    if (falhou) {
      await supabase.from("questoes").update({ precisa_revisao: true, motivo_revisao: [linha.motivo_revisao, "Uma imagem não pôde ser copiada do enem.dev."].filter(Boolean).join(" ") }).eq("id", criada.id);
    } else if (!linha.precisa_revisao) {
      await supabase.from("questoes").update({ precisa_revisao: false }).eq("id", criada.id);
    }
  }

  const feitas = offset + corpo.questions.length;
  const { error: erroAvanco } = await supabase.from("importacoes").update({ paginas_lidas: feitas, total_paginas: corpo.metadata.total, updated_at: new Date().toISOString() }).eq("id", importacaoId);
  if (erroAvanco) throw new Error(erroAvanco.message);
  if (corpo.metadata.hasMore && corpo.questions.length > 0) {
    return { importacaoId, feitas, total: corpo.metadata.total, terminou: false, status: "enviando" };
  }
  if (!iaDisponivel()) {
    // Sem chave: o ano fica baixado e em revisão; rodar de novo com a chave configurada classifica.
    await marcarSemClassificacao(importacaoId);
    await supabase.from("importacoes").update({ status: "revisao", updated_at: new Date().toISOString() }).eq("id", importacaoId).eq("status", "enviando");
    return { importacaoId, feitas, total: corpo.metadata.total, terminou: true, status: "revisao", semIA: true };
  }
  await classificarAgora(importacaoId, "enviando");
  return { importacaoId, feitas, total: corpo.metadata.total, terminou: false, status: "lendo" };
}

class LoteCriadoError extends Error {}

async function iniciarClassificacao(importacaoId: string) {
  // Sem assuntos aprovados a IA inventaria um assunto por questão: garante a lista inicial antes.
  const { count: aprovados } = await supabase.from("assuntos").select("id", { count: "exact", head: true }).eq("situacao", "aprovado");
  if ((aprovados ?? 0) === 0) await inserirAssuntosIniciais();
  const [{ data: questoes }, { data: assuntos }] = await Promise.all([
    supabase.from("questoes").select("id, area, enunciado, comando").eq("importacao_id", importacaoId).is("assunto_id", null),
    supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado"),
  ]);
  const lista = questoes ?? [];
  if (lista.length === 0) {
    await supabase.from("importacoes").update({ status: "revisao" }).eq("id", importacaoId).eq("status", "lendo");
    return;
  }
  const pedidos = [];
  for (let i = 0; i < lista.length; i += POR_PEDIDO) pedidos.push(pedidoClassificacao(`c${i}`, lista.slice(i, i + POR_PEDIDO), assuntos ?? []));
  const lote = await clienteIA().messages.batches.create({ requests: pedidos });
  const { error: erroBatch } = await supabase.from("importacoes").update({ batch_id: lote.id, status: "lendo", updated_at: new Date().toISOString() }).eq("id", importacaoId);
  if (erroBatch) throw new LoteCriadoError(`O lote ${lote.id} foi criado na Anthropic, mas não foi possível gravá-lo: ${erroBatch.message}`);
  await supabase.from("importacoes").update({ custo_estimado_usd: Math.round(pedidos.length * 0.05 * 100) / 100 }).eq("id", importacaoId);
}

/** Reaproveita o assunto (mesma matéria, nome sem diferenciar maiúsculas) ou cria um proposto. */
async function assuntoProposto(materia: string, nome: string): Promise<string | null> {
  const limpo = nome.replace(/\*/g, "").trim();
  if (!limpo) return null;
  const padrao = limpo.replace(/[%_\\]/g, (c) => "\\" + c);
  const { data: achado } = await supabase.from("assuntos").select("id").eq("materia", materia).ilike("nome", padrao).limit(1).maybeSingle();
  if (achado) return achado.id;
  const { data: novo } = await supabase.from("assuntos").insert({ materia, nome: limpo, situacao: "proposto" }).select("id").maybeSingle();
  return novo?.id ?? null;
}

export async function atualizarClassificacaoEnem(importacaoId: string): Promise<PassoEnem> {
  await exigirDono();
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  if (!imp) throw new Error("Importação não encontrada.");
  const passo = (status: StatusImportacao, terminou: boolean): PassoEnem => ({ importacaoId, feitas: imp.paginas_lidas, total: imp.total_paginas, terminou, status });
  if (imp.status === "lendo" && !imp.batch_id) {
    // Lote ainda sendo criado; se passou de 10 minutos, a criação travou: volta para 'enviando' para o próximo passo reservar de novo.
    const parada = Date.now() - new Date(imp.updated_at).getTime() > 10 * 60_000;
    if (!parada) return passo("lendo", false);
    const { data: resetou } = await supabase.from("importacoes").update({ status: "enviando", updated_at: new Date().toISOString() }).eq("id", importacaoId).eq("status", "lendo").is("batch_id", null).select("id");
    return passo(resetou && resetou.length > 0 ? "enviando" : "lendo", false);
  }
  if (imp.status !== "lendo" || !imp.batch_id) return passo(imp.status, imp.status !== "enviando");
  const lote = await clienteIA().messages.batches.retrieve(imp.batch_id);
  if (lote.processing_status !== "ended") return { ...passo("lendo", false), progresso: progressoDoLote(lote.request_counts) };

  const { data: tomou } = await supabase.from("importacoes").update({ status: "revisao" }).eq("id", importacaoId).eq("status", "lendo").select("id");
  if (!tomou || tomou.length === 0) return passo("revisao", true);

  const { data: assuntos } = await supabase.from("assuntos").select("id, materia").eq("situacao", "aprovado");
  const mapa = new Map((assuntos ?? []).map((a) => [a.id, a.materia]));
  const { data: daImportacao } = await supabase.from("questoes").select("id").eq("importacao_id", importacaoId);
  const idsEsperados = new Set((daImportacao ?? []).map((q) => q.id));
  const atualizadas = new Set<string>();
  let custo = 0;
  for await (const r of await clienteIA().messages.batches.results(imp.batch_id)) {
    if (r.result.type !== "succeeded") continue;
    custo += custoDoUso(r.result.message.usage);
    const bloco = r.result.message.content.find((b) => b.type === "text");
    const analise = ClassificacaoSchema.safeParse((() => { try { return JSON.parse(bloco && bloco.type === "text" ? bloco.text : ""); } catch { return null; } })());
    if (!analise.success) continue;
    for (const u of classificacaoParaAtualizacoes(analise.data, mapa, idsEsperados)) {
      let assunto_id = u.assunto_id;
      if (u.assuntoNovo) assunto_id = await assuntoProposto(u.materia, u.assuntoNovo);
      const { data: q } = await supabase.from("questoes").select("precisa_revisao, motivo_revisao, importacao_id").eq("id", u.id).maybeSingle();
      if (!q || q.importacao_id !== importacaoId) continue;
      atualizadas.add(u.id);
      // Os avisos da classificação anterior saem; os outros motivos continuam.
      const motivoBase = motivoSemClassificacao(q.motivo_revisao);
      await supabase.from("questoes").update({
        materia: u.materia, area: u.area, assunto_id,
        precisa_revisao: !!motivoBase || u.precisa,
        motivo_revisao: u.precisa ? [motivoBase, u.assuntoNovo ? `Assunto novo proposto: ${u.assuntoNovo}.` : "Sem assunto."].filter(Boolean).join(" ") : motivoBase,
      }).eq("id", u.id);
    }
  }
  // Quem a IA não classificou fica em revisão.
  for (const id of idsEsperados) {
    if (atualizadas.has(id)) continue;
    const { data: q } = await supabase.from("questoes").select("motivo_revisao").eq("id", id).maybeSingle();
    await supabase.from("questoes").update({ precisa_revisao: true, motivo_revisao: [q?.motivo_revisao, "Não classificada pela IA."].filter(Boolean).join(" ") }).eq("id", id).is("assunto_id", null);
  }
  // Publica o que veio limpo (fonte já revisada); o resto fica em revisão.
  await supabase.from("questoes").update({ status: "publicada" }).eq("importacao_id", importacaoId).eq("precisa_revisao", false).not("assunto_id", "is", null).not("resposta", "is", null);
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  const final: StatusImportacao = (count ?? 0) === 0 ? "concluida" : "revisao";
  await supabase.from("importacoes").update({ status: final, custo_real_usd: Math.round(custo * 100) / 100, updated_at: new Date().toISOString() }).eq("id", importacaoId);
  return passo(final, true);
}
