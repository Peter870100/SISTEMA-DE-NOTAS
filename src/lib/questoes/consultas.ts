import { supabase } from "@/lib/supabase/client";
import { linksExibicao } from "@/lib/questoes/storage";
import type { ImagemTela } from "@/components/questoes/ImagemQuestao";

export async function imagensParaTela(questaoIds: string[]): Promise<Map<string, ImagemTela[]>> {
  const mapa = new Map<string, ImagemTela[]>();
  if (questaoIds.length === 0) return mapa;
  const { data: imagens } = await supabase.from("questao_imagens").select("*").in("questao_id", questaoIds).order("ordem");
  const paginaIds = [...new Set((imagens ?? []).map((i) => i.pagina_id).filter((p): p is string => !!p))];
  const { data: paginas } = paginaIds.length ? await supabase.from("importacao_paginas").select("*").in("id", paginaIds) : { data: [] };
  const paginaPorId = new Map((paginas ?? []).map((p) => [p.id, p]));
  const caminhos = [
    ...(imagens ?? []).filter((i) => i.tipo === "arquivo" && i.storage_path).map((i) => i.storage_path as string),
    ...(paginas ?? []).map((p) => p.storage_path),
  ];
  const links = await linksExibicao(caminhos);
  for (const i of imagens ?? []) {
    const pagina = i.pagina_id ? paginaPorId.get(i.pagina_id) : undefined;
    const url = i.tipo === "arquivo" ? links.get(i.storage_path ?? "") : pagina ? links.get(pagina.storage_path) : undefined;
    if (!url) continue;
    const tela: ImagemTela = {
      id: i.id, alvo: i.alvo, tipo: i.tipo, url,
      quadro: i.tipo === "recorte" ? { x: Number(i.x), y: Number(i.y), w: Number(i.w), h: Number(i.h) } : null,
      largura: pagina?.largura ?? null, altura: pagina?.altura ?? null,
    };
    mapa.set(i.questao_id, [...(mapa.get(i.questao_id) ?? []), tela]);
  }
  return mapa;
}
