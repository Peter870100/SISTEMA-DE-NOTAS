"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirEditorQuestao, exigirProfessor } from "@/lib/questoes/acesso";
import { ehMateria, areaDaMateria, LETRAS } from "@/lib/questoes/materias";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";
import { BUCKET } from "@/lib/questoes/storage";
import { camposConferida, camposFaltaImagem } from "@/lib/questoes/conferencia";
import { limparConteudo, textoDoConteudo } from "@/lib/questoes/conteudo";
import type { Alinhamento, AlvoImagem, Escopo, Letra } from "@/lib/types";

export type DadosQuestao = {
  banca: string;
  ano: number | null;
  caderno: string;
  numero: number | null;
  materia: string;
  assunto_id: string | null;
  enunciado: string;
  comando: string;
  alternativas: { letra: Letra; texto: string; conteudo?: unknown }[];
  resposta: Letra | null;
  anulada: boolean;
  escopo?: Escopo;
  /** Documento formatado do enunciado (entrada não confiável). Ausente: mantém o comportamento de texto puro. */
  conteudo?: unknown;
};

const MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const TAMANHO_MAXIMO = 5242880;

function limpar(d: DadosQuestao) {
  const banca = d.banca.trim();
  if (!banca) throw new Error("Informe a banca.");
  if (!ehMateria(d.materia)) throw new Error("Escolha a matéria.");
  const alternativas = LETRAS.map((letra) => {
    const alt = d.alternativas.find((a) => a.letra === letra);
    if (alt?.conteudo !== undefined) {
      const doc = limparConteudo(alt.conteudo, { modo: "alternativa" });
      if (doc) return { letra, texto: textoDoConteudo(doc).trim(), conteudo: doc };
    }
    return { letra, texto: (alt?.texto ?? "").trim() };
  });
  if (d.resposta && !LETRAS.includes(d.resposta)) throw new Error("Resposta inválida.");
  return {
    banca,
    ano: d.ano && Number.isInteger(d.ano) ? d.ano : null,
    caderno: d.caderno.trim(),
    numero: d.numero && Number.isInteger(d.numero) ? d.numero : null,
    area: areaDaMateria(d.materia),
    materia: d.materia,
    assunto_id: d.assunto_id || null,
    enunciado: d.enunciado.trim(),
    comando: d.comando.trim(),
    alternativas,
    resposta: d.resposta,
    anulada: d.anulada,
  };
}

/** Campos do enunciado: se veio `conteudo`, limpa o documento e deriva o texto puro dele. */
function camposEnunciado(d: DadosQuestao, imagensValidas: Set<string>) {
  if (d.conteudo === undefined) return {};
  const doc = limparConteudo(d.conteudo, { modo: "enunciado", imagensValidas });
  return doc ? { conteudo: doc, enunciado: textoDoConteudo(doc).trim() } : { conteudo: null };
}

function traduzirErro(message: string): string {
  return message.includes("uq_questoes") ? "Já existe uma questão com essa banca, ano, caderno e número." : message;
}

export async function criarQuestao(dados: DadosQuestao): Promise<string> {
  const professor = await exigirProfessor();
  const escopo: Escopo = dados.escopo === "geral" && professor.role === "dono" ? "geral" : "escola";
  const { data, error } = await supabase
    .from("questoes")
    .insert({ ...limpar(dados), ...camposEnunciado(dados, new Set()), escopo, escola_id: escopo === "geral" ? null : professor.escola_id, origem: "manual", status: "revisao", criado_por: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(traduzirErro(error?.message ?? "Falha ao criar questão."));
  return data.id;
}

export async function salvarQuestao(id: string, dados: DadosQuestao): Promise<void> {
  const { questao } = await exigirEditorQuestao(id);
  const limpo = limpar(dados);
  if (questao.status === "publicada" && !limpo.anulada && !limpo.resposta) throw new Error("Questão publicada precisa de resposta (ou ser anulada).");
  let imagensValidas = new Set<string>();
  if (dados.conteudo !== undefined) {
    const { data: imagens, error: erroImagens } = await supabase.from("questao_imagens").select("id").eq("questao_id", id).eq("alvo", "enunciado");
    if (erroImagens) throw new Error(erroImagens.message);
    imagensValidas = new Set((imagens ?? []).map((i) => i.id));
  }
  const { error } = await supabase.from("questoes").update({ ...limpo, ...camposEnunciado(dados, imagensValidas), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function publicarQuestao(id: string, publicar: boolean): Promise<void> {
  const { questao } = await exigirEditorQuestao(id);
  if (publicar && !questao.anulada && !questao.resposta) throw new Error("Marque a resposta certa (ou anulada) antes de publicar.");
  const { error } = await supabase
    .from("questoes")
    .update({ status: publicar ? "publicada" : "revisao", precisa_revisao: publicar ? false : questao.precisa_revisao, ...(publicar ? { falta_imagem: false } : {}), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (publicar) await concluirImportacaoSeVazia(questao.importacao_id);
  // Listas do banco e das importações mudam de situação: não mostrar a versão guardada no navegador.
  revalidatePath("/banco", "layout");
}

/** Marca a importação como concluída quando nenhuma questão dela sobra em revisão. */
async function concluirImportacaoSeVazia(importacaoId: string | null) {
  if (!importacaoId) return;
  const { count } = await supabase.from("questoes").select("id", { count: "exact", head: true }).eq("importacao_id", importacaoId).eq("status", "revisao");
  if (count === 0) await supabase.from("importacoes").update({ status: "concluida" }).eq("id", importacaoId).eq("status", "revisao");
}

export async function marcarFaltaImagem(questaoId: string): Promise<void> {
  await exigirEditorQuestao(questaoId);
  const { error } = await supabase.from("questoes").update({ ...camposFaltaImagem(), updated_at: new Date().toISOString() }).eq("id", questaoId);
  if (error) throw new Error(error.message);
  revalidatePath("/banco", "layout");
}

export async function marcarConferida(questaoId: string): Promise<void> {
  const { questao } = await exigirEditorQuestao(questaoId);
  if (!questao.anulada && !questao.resposta) throw new Error("Marque a resposta certa (ou anulada) antes de publicar.");
  const agora = new Date();
  const { error } = await supabase.from("questoes").update({ ...camposConferida(agora), updated_at: agora.toISOString() }).eq("id", questaoId);
  if (error) throw new Error(error.message);
  await concluirImportacaoSeVazia(questao.importacao_id);
  revalidatePath("/banco", "layout");
}

export async function criarRecorte(questaoId: string, paginaId: string, alvo: AlvoImagem, quadro: Quadro): Promise<void> {
  const { questao } = await exigirEditorQuestao(questaoId);
  if (!["enunciado", ...LETRAS].includes(alvo)) throw new Error("Destino da imagem inválido.");
  const { data: pagina } = await supabase.from("importacao_paginas").select("id, importacao_id, tipo").eq("id", paginaId).maybeSingle();
  if (!pagina || pagina.tipo !== "prova" || !questao.importacao_id || pagina.importacao_id !== questao.importacao_id) throw new Error("Página de outra prova.");
  const { count } = await supabase.from("questao_imagens").select("id", { count: "exact", head: true }).eq("questao_id", questaoId).eq("alvo", alvo);
  const { error } = await supabase
    .from("questao_imagens")
    .insert({ questao_id: questaoId, alvo, tipo: "recorte", pagina_id: paginaId, ordem: count ?? 0, ...limitarQuadro(quadro) });
  if (error) throw new Error(error.message);
  revalidatePath("/banco", "layout");
}

export async function definirAlinhamento(imagemId: string, alinhamento: Alinhamento): Promise<void> {
  if (!["esquerda", "centro", "direita"].includes(alinhamento)) throw new Error("Posição inválida.");
  const { data: img } = await supabase.from("questao_imagens").select("questao_id").eq("id", imagemId).maybeSingle();
  if (!img) throw new Error("Imagem não encontrada.");
  await exigirEditorQuestao(img.questao_id);
  const { error } = await supabase.from("questao_imagens").update({ alinhamento }).eq("id", imagemId);
  if (error) throw new Error(error.message);
  revalidatePath("/banco", "layout");
}

export async function excluirQuestao(id: string): Promise<void> {
  await exigirEditorQuestao(id);
  const { data: imagens } = await supabase.from("questao_imagens").select("storage_path").eq("questao_id", id).eq("tipo", "arquivo");
  const caminhos = (imagens ?? []).map((i) => i.storage_path).filter((p): p is string => !!p);
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
  const { error } = await supabase.from("questoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Copia uma questão de escola para o banco geral (só dono). Imagens 'arquivo' são copiadas no Storage. */
export async function promoverQuestao(id: string): Promise<string> {
  const { professor, questao } = await exigirEditorQuestao(id);
  if (professor.role !== "dono" || questao.escopo !== "escola") throw new Error("Só o dono promove questões de escola.");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _c, updated_at: _u, ...resto } = questao;
  const { data: nova, error } = await supabase
    .from("questoes")
    .insert({ ...resto, escopo: "geral", escola_id: null, numero: null, status: "revisao", criado_por: professor.id })
    .select("id")
    .single();
  if (error || !nova) throw new Error(error?.message ?? "Falha ao promover.");
  const MSG = "Não foi possível promover a questão (imagens). Nada foi alterado.";
  const copiados: string[] = [];
  const desfazer = async () => {
    try {
      if (copiados.length) await supabase.storage.from(BUCKET).remove(copiados);
      await supabase.from("questao_imagens").delete().eq("questao_id", nova.id);
      await supabase.from("questoes").delete().eq("id", nova.id);
    } catch {
      // limpeza best-effort
    }
  };
  const { data: imagens, error: erroImagens } = await supabase.from("questao_imagens").select("*").eq("questao_id", id);
  if (erroImagens) {
    await desfazer();
    throw new Error(MSG);
  }
  for (const img of imagens ?? []) {
    let storage_path = img.storage_path;
    if (img.tipo === "arquivo" && img.storage_path) {
      const ext = img.storage_path.split(".").pop();
      storage_path = `imagens/${nova.id}/${randomUUID()}.${ext}`;
      const { error: erroCopia } = await supabase.storage.from(BUCKET).copy(img.storage_path, storage_path);
      if (erroCopia) {
        await desfazer();
        throw new Error(MSG);
      }
      copiados.push(storage_path);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _i, created_at: _ci, questao_id: _q, ...dadosImg } = img;
    const { error: erroInsert } = await supabase.from("questao_imagens").insert({ ...dadosImg, questao_id: nova.id, storage_path });
    if (erroInsert) {
      await desfazer();
      throw new Error(MSG);
    }
  }
  return nova.id;
}

export async function prepararEnvioImagem(questaoId: string, _nome: string, tamanho: number, tipoMime: string) {
  await exigirEditorQuestao(questaoId);
  const ext = MIME[tipoMime];
  if (!ext) throw new Error("Envie PNG, JPG ou WEBP.");
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) throw new Error("A imagem precisa ter até 5 MB.");
  const storagePath = `imagens/${questaoId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Falha ao preparar envio.");
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarImagem(questaoId: string, alvo: AlvoImagem, storagePath: string, substituirId: string | null): Promise<string> {
  await exigirEditorQuestao(questaoId);
  if (!["enunciado", ...LETRAS].includes(alvo)) throw new Error("Destino da imagem inválido.");
  const prefixo = `imagens/${questaoId}/`;
  if (!storagePath.startsWith(prefixo) || !/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(storagePath.slice(prefixo.length))) {
    throw new Error("Caminho de imagem inválido.");
  }
  const { data: existente } = await supabase.from("questao_imagens").select("id").eq("storage_path", storagePath).maybeSingle();
  if (existente) throw new Error("Imagem já registrada.");
  const { count } = await supabase.from("questao_imagens").select("id", { count: "exact", head: true }).eq("questao_id", questaoId).eq("alvo", alvo);
  const { data: nova, error } = await supabase.from("questao_imagens").insert({ questao_id: questaoId, alvo, tipo: "arquivo", storage_path: storagePath, ordem: count ?? 0 }).select("id").single();
  if (error || !nova) throw new Error(error?.message ?? "Falha ao registrar imagem.");
  if (substituirId) await removerImagemInterna(questaoId, substituirId);
  return nova.id;
}

async function removerImagemInterna(questaoId: string, imagemId: string) {
  const { data: img } = await supabase.from("questao_imagens").select("*").eq("id", imagemId).eq("questao_id", questaoId).maybeSingle();
  if (!img) return;
  if (img.tipo === "arquivo" && img.storage_path) await supabase.storage.from(BUCKET).remove([img.storage_path]);
  await supabase.from("questao_imagens").delete().eq("id", imagemId);
}

export async function removerImagem(imagemId: string): Promise<void> {
  const { data: img } = await supabase.from("questao_imagens").select("questao_id").eq("id", imagemId).maybeSingle();
  if (!img) return;
  await exigirEditorQuestao(img.questao_id);
  await removerImagemInterna(img.questao_id, imagemId);
}

export async function atualizarRecorte(imagemId: string, quadro: Quadro): Promise<void> {
  const { data: img } = await supabase.from("questao_imagens").select("questao_id, tipo").eq("id", imagemId).maybeSingle();
  if (!img || img.tipo !== "recorte") throw new Error("Recorte não encontrado.");
  await exigirEditorQuestao(img.questao_id);
  const { error } = await supabase.from("questao_imagens").update(limitarQuadro(quadro)).eq("id", imagemId);
  if (error) throw new Error(error.message);
}
