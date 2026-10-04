"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirImportacao, exigirProfessor, podeImportar } from "@/lib/questoes/acesso";
import { clienteIA, custoDoUso, estimarCustoPaginas, instrucoesLeitura, pedidoPagina } from "@/lib/questoes/ia";
import { BUCKET, linkParaIA } from "@/lib/questoes/storage";
import { RespostaPaginaSchema, respostaParaQuestoes } from "@/lib/questoes/formato-ia";
import type { Escopo, StatusImportacao } from "@/lib/types";

const MAX_PAGINAS = 60;

export async function criarImportacao(d: { escopo: Escopo; banca: string; ano: number | null; caderno: string }): Promise<string> {
  const professor = await exigirProfessor();
  if (!podeImportar(professor, d.escopo)) throw new Error("Você não pode importar provas nesse banco.");
  const banca = d.banca.trim();
  if (!banca) throw new Error("Informe a banca.");
  const { data, error } = await supabase
    .from("importacoes")
    .insert({ escopo: d.escopo, escola_id: d.escopo === "geral" ? null : professor.escola_id, origem: "pdf", banca, ano: d.ano, caderno: d.caderno.trim(), criado_por: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar importação.");
  return data.id;
}

function caminhoPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number) {
  return `${importacaoId}/${tipo}-${numero}.jpg`;
}

export async function prepararEnvioPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number) {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já foi enviada.");
  if (!["prova", "gabarito"].includes(tipo) || !Number.isInteger(numero) || numero < 1 || numero > MAX_PAGINAS) throw new Error("Página inválida.");
  const storagePath = caminhoPagina(importacaoId, tipo, numero);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar envio.");
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarPagina(importacaoId: string, tipo: "prova" | "gabarito", numero: number, largura: number, altura: number) {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já foi enviada.");
  if (!Number.isInteger(largura) || !Number.isInteger(altura) || largura < 100 || altura < 100) throw new Error("Página inválida.");
  const { error } = await supabase
    .from("importacao_paginas")
    .upsert({ importacao_id: importacaoId, tipo, numero, storage_path: caminhoPagina(importacaoId, tipo, numero), largura, altura, status: "pendente" }, { onConflict: "importacao_id,tipo,numero" });
  if (error) throw new Error(error.message);
}

async function assuntosAprovados() {
  const { data } = await supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado").order("materia");
  return data ?? [];
}

/** Cria o lote com um pedido por página da prova (todas ou só as indicadas). */
async function enviarLote(importacaoId: string, somentePaginas: number[] | null) {
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  const { data: paginas } = await supabase.from("importacao_paginas").select("*").eq("importacao_id", importacaoId).order("numero");
  const provas = (paginas ?? []).filter((p) => p.tipo === "prova");
  const gabaritos = (paginas ?? []).filter((p) => p.tipo === "gabarito");
  if (!importacao || provas.length === 0) throw new Error("Envie as páginas da prova primeiro.");

  const instrucoes = instrucoesLeitura(importacao.banca, importacao.ano, importacao.caderno, await assuntosAprovados());
  const gabaritoUrls = await Promise.all(gabaritos.map((g) => linkParaIA(g.storage_path)));
  const alvo = provas.filter((p) => !somentePaginas || somentePaginas.includes(p.numero));
  const pedidos = await Promise.all(alvo.map(async (p) => {
    const proxima = provas.find((q) => q.numero === p.numero + 1);
    return pedidoPagina({
      customId: p.id,
      paginaUrl: await linkParaIA(p.storage_path),
      proximaUrl: proxima ? await linkParaIA(proxima.storage_path) : null,
      gabaritoUrls,
      instrucoes,
    });
  }));
  const lote = await clienteIA().messages.batches.create({ requests: pedidos });
  await supabase.from("importacao_paginas").update({ status: "pendente", erro: null }).in("id", alvo.map((p) => p.id));
  await supabase
    .from("importacoes")
    .update({ batch_id: lote.id, status: "lendo", total_paginas: provas.length, erro: null, custo_estimado_usd: estimarCustoPaginas(provas.length), updated_at: new Date().toISOString() })
    .eq("id", importacaoId);
}

export async function iniciarLeitura(importacaoId: string): Promise<void> {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status !== "enviando") throw new Error("Essa importação já está sendo lida.");
  await enviarLote(importacaoId, null);
}

export type SituacaoImportacao = {
  status: StatusImportacao;
  total: number;
  lidas: number;
  erros: { pagina: number; erro: string }[];
  avisos: string[];
  custoEstimado: number | null;
  custoReal: number | null;
  questoes: number;
};

/** Consulta o lote; quando terminou, grava as questões (só um chamador processa). */
export async function atualizarImportacao(importacaoId: string): Promise<SituacaoImportacao> {
  const { importacao } = await exigirImportacao(importacaoId);
  let avisos: string[] = [];
  if (importacao.status === "lendo" && importacao.batch_id) {
    const lote = await clienteIA().messages.batches.retrieve(importacao.batch_id);
    if (lote.processing_status === "ended") {
      const { data: tomou } = await supabase
        .from("importacoes")
        .update({ status: "revisao", updated_at: new Date().toISOString() })
        .eq("id", importacaoId)
        .eq("status", "lendo")
        .select("id");
      if (tomou && tomou.length > 0) avisos = await gravarResultados(importacaoId, importacao.batch_id);
    } else {
      const feitas = lote.request_counts.succeeded + lote.request_counts.errored + lote.request_counts.canceled + lote.request_counts.expired;
      await supabase.from("importacoes").update({ paginas_lidas: feitas }).eq("id", importacaoId);
    }
  }
  return situacao(importacaoId, avisos);
}

/** Reaproveita o assunto (mesma matéria, nome sem diferenciar maiúsculas) ou cria um proposto. */
async function assuntoProposto(materia: string, nome: string): Promise<string | null> {
  const padrao = nome.replace(/[\%_]/g, (c) => "\\" + c);
  const { data: achado } = await supabase.from("assuntos").select("id").eq("materia", materia).ilike("nome", padrao).limit(1).maybeSingle();
  if (achado) return achado.id;
  const { data: novo } = await supabase.from("assuntos").insert({ materia, nome, situacao: "proposto" }).select("id").maybeSingle();
  return novo?.id ?? null;
}

async function gravarResultados(importacaoId: string, batchId: string): Promise<string[]> {
  const { data: importacao } = await supabase.from("importacoes").select("*").eq("id", importacaoId).single();
  const { data: paginas } = await supabase.from("importacao_paginas").select("*").eq("importacao_id", importacaoId);
  const { data: existentes } = await supabase.from("questoes").select("numero").eq("importacao_id", importacaoId);
  const assuntos = await assuntosAprovados();
  const mapaAssuntos = new Map(assuntos.map((a) => [a.id, a.materia]));
  const numerosExistentes = new Set((existentes ?? []).map((e) => e.numero).filter((n): n is number => n !== null));
  const avisos: string[] = [];
  let custo = Number(importacao!.custo_real_usd ?? 0);
  let lidas = 0;

  for await (const r of await clienteIA().messages.batches.results(batchId)) {
    const pagina = (paginas ?? []).find((p) => p.id === r.custom_id);
    if (!pagina) continue;
    if (r.result.type !== "succeeded") {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: `Falha na leitura (${r.result.type}).` }).eq("id", pagina.id);
      continue;
    }
    const msg = r.result.message;
    custo += custoDoUso(msg.usage);
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: msg.stop_reason === "refusal" ? "A IA recusou esta página." : "Resposta cortada." }).eq("id", pagina.id);
      continue;
    }
    const texto = msg.content.find((b) => b.type === "text");
    let resposta;
    try {
      resposta = RespostaPaginaSchema.parse(JSON.parse(texto && texto.type === "text" ? texto.text : ""));
    } catch {
      await supabase.from("importacao_paginas").update({ status: "erro", erro: "Resposta da IA fora do formato." }).eq("id", pagina.id);
      continue;
    }
    const { questoes, avisos: av } = respostaParaQuestoes(resposta, {
      escopo: importacao!.escopo, escola_id: importacao!.escola_id, banca: importacao!.banca, ano: importacao!.ano, caderno: importacao!.caderno,
      importacao_id: importacaoId, pagina_id: pagina.id, numerosExistentes, assuntos: mapaAssuntos,
    });
    avisos.push(...av.map((a) => `Página ${pagina.numero}: ${a}`));
    for (const q of questoes) {
      let assunto_id = q.linha.assunto_id ?? null;
      if (q.assuntoNovo) {
        assunto_id = await assuntoProposto(q.assuntoNovo.materia, q.assuntoNovo.nome);
      }
      const { data: criada, error } = await supabase.from("questoes").insert({ ...q.linha, assunto_id }).select("id").single();
      if (error || !criada) {
        avisos.push(`Página ${pagina.numero}: questão ${q.linha.numero} não foi gravada (${error?.message.includes("uq_questoes") ? "já existe no banco" : error?.message}).`);
        continue;
      }
      if (q.imagens.length) {
        await supabase.from("questao_imagens").insert(q.imagens.map((f, i) => ({ questao_id: criada.id, alvo: f.alvo, ordem: i, tipo: "recorte" as const, pagina_id: pagina.id, x: f.x, y: f.y, w: f.w, h: f.h })));
      }
    }
    await supabase.from("importacao_paginas").update({ status: "lida", erro: null }).eq("id", pagina.id);
    lidas++;
  }
  await supabase
    .from("importacoes")
    .update({ custo_real_usd: Math.round(custo * 100) / 100, paginas_lidas: lidas, erro: avisos.length ? avisos.join("\n").slice(0, 4000) : null, updated_at: new Date().toISOString() })
    .eq("id", importacaoId);
  return avisos;
}

async function situacao(importacaoId: string, avisosNovos: string[]): Promise<SituacaoImportacao> {
  const [{ data: imp }, { data: paginas }, { count }] = await Promise.all([
    supabase.from("importacoes").select("*").eq("id", importacaoId).single(),
    supabase.from("importacao_paginas").select("numero, status, erro, tipo").eq("importacao_id", importacaoId),
    supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId),
  ]);
  const avisos = avisosNovos.length ? avisosNovos : (imp?.erro ?? "").split("\n").filter(Boolean);
  return {
    status: imp!.status,
    total: imp!.total_paginas,
    lidas: imp!.paginas_lidas,
    erros: (paginas ?? []).filter((p) => p.tipo === "prova" && p.status === "erro").map((p) => ({ pagina: p.numero, erro: p.erro ?? "Erro" })),
    avisos,
    custoEstimado: imp!.custo_estimado_usd,
    custoReal: imp!.custo_real_usd,
    questoes: count ?? 0,
  };
}

export async function lerDeNovo(importacaoId: string): Promise<void> {
  const { importacao } = await exigirImportacao(importacaoId);
  if (importacao.status === "lendo") throw new Error("A leitura ainda está em andamento.");
  const { data: comErro } = await supabase.from("importacao_paginas").select("numero").eq("importacao_id", importacaoId).eq("tipo", "prova").eq("status", "erro");
  const numeros = (comErro ?? []).map((p) => p.numero);
  if (numeros.length === 0) throw new Error("Nenhuma página com erro.");
  await enviarLote(importacaoId, numeros);
}

export async function aprovarTodasSemAviso(importacaoId: string): Promise<number> {
  await exigirImportacao(importacaoId);
  const { data, error } = await supabase
    .from("questoes")
    .update({ status: "publicada", updated_at: new Date().toISOString() })
    .eq("importacao_id", importacaoId)
    .eq("status", "revisao")
    .eq("precisa_revisao", false)
    .or("resposta.not.is.null,anulada.eq.true")
    .select("id");
  if (error) throw new Error(error.message);
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  if ((count ?? 0) === 0) await supabase.from("importacoes").update({ status: "concluida" }).eq("id", importacaoId);
  return data?.length ?? 0;
}
