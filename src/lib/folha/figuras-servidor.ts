import sharp from "sharp";
import { supabase } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/questoes/storage";
import { MATERIAS } from "@/lib/questoes/materias";
import type { FiguraFolha, QuestaoFolha } from "./docx";
import { pixelsDoRecorte } from "./recorte";

async function baixar(caminho: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) {
    console.error(`carregarQuestoesFolha: falha ao baixar ${caminho}: ${error?.message ?? "sem dados"}`);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

/** Lê as questões (na ordem de `ids`) com as figuras já em PNG. `faltando` = ids que não existem mais. */
export async function carregarQuestoesFolha(ids: string[]): Promise<{ questoes: QuestaoFolha[]; faltando: string[] }> {
  if (ids.length === 0) return { questoes: [], faltando: [] };
  const { data: linhas, error } = await supabase
    .from("questoes")
    .select("id, enunciado, comando, alternativas, resposta, resolucao, materia, conteudo, banca, ano")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const porId = new Map((linhas ?? []).map((r) => [r.id as string, r] as const));

  const { data: imagens, error: errImg } = await supabase.from("questao_imagens").select("*").in("questao_id", ids).order("ordem");
  if (errImg) throw new Error(errImg.message);
  const paginaIds = [...new Set((imagens ?? []).map((i) => i.pagina_id).filter((p): p is string => !!p))];
  const { data: paginas, error: errPag } = paginaIds.length
    ? await supabase.from("importacao_paginas").select("id, storage_path, largura, altura").in("id", paginaIds)
    : { data: [], error: null };
  if (errPag) throw new Error(errPag.message);
  const paginaPorId = new Map((paginas ?? []).map((p) => [p.id as string, p]));

  // Cada arquivo é baixado uma vez (várias figuras podem recortar a mesma página).
  const cache = new Map<string, Promise<Buffer | null>>();
  const arquivo = (caminho: string) => {
    if (!cache.has(caminho)) cache.set(caminho, baixar(caminho));
    return cache.get(caminho)!;
  };

  async function montarFigura(i: Record<string, any>): Promise<FiguraFolha> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const base = { id: i.id as string, alvo: i.alvo as FiguraFolha["alvo"], alinhamento: (i.alinhamento ?? "centro") as FiguraFolha["alinhamento"] };
    try {
      let png: Buffer | null = null;
      if (i.tipo === "arquivo") {
        const buf = i.storage_path ? await arquivo(i.storage_path) : null;
        if (buf) png = await sharp(buf).png().toBuffer();
      } else {
        const pagina = i.pagina_id ? paginaPorId.get(i.pagina_id) : undefined;
        const buf = pagina ? await arquivo(pagina.storage_path) : null;
        if (buf && pagina) {
          const quadro = { x: Number(i.x), y: Number(i.y), w: Number(i.w), h: Number(i.h) };
          png = await sharp(buf).extract(pixelsDoRecorte(quadro, pagina.largura, pagina.altura)).png().toBuffer();
        }
      }
      if (!png) return { ...base, png: null, largura: 0, altura: 0 };
      const meta = await sharp(png).metadata();
      return { ...base, png, largura: meta.width ?? 0, altura: meta.height ?? 0 };
    } catch (e) {
      console.error(`carregarQuestoesFolha: falha na figura ${base.id}: ${e instanceof Error ? e.message : e}`);
      return { ...base, png: null, largura: 0, altura: 0 };
    }
  }

  const figuras = await Promise.all((imagens ?? []).map(montarFigura));
  const figurasDaQuestao = new Map<string, FiguraFolha[]>();
  (imagens ?? []).forEach((i, n) => {
    figurasDaQuestao.set(i.questao_id, [...(figurasDaQuestao.get(i.questao_id) ?? []), figuras[n]]);
  });

  const questoes: QuestaoFolha[] = [];
  const faltando: string[] = [];
  for (const id of ids) {
    const r = porId.get(id);
    if (!r) { faltando.push(id); continue; }
    questoes.push({
      id,
      enunciado: r.enunciado ?? "",
      conteudo: r.conteudo ?? null,
      comando: r.comando ?? "",
      alternativas: r.alternativas ?? [],
      resposta: r.resposta ?? null,
      resolucao: r.resolucao ?? null,
      materia: (MATERIAS as Record<string, { rotulo: string }>)[r.materia as string]?.rotulo ?? r.materia ?? "",
      figuras: figurasDaQuestao.get(id) ?? [],
      origem: r.banca ? `${String(r.banca).toUpperCase()}${r.ano ? ` ${r.ano}` : ""}` : null,
    });
  }
  return { questoes, faltando };
}
