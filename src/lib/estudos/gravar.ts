import type { SupabaseClient } from "@supabase/supabase-js";
import type { Letra, MaterialEstudo } from "../types";
import { trocarImagens, validarBlocos } from "./blocos";
import { BUCKET_ESTUDOS, gravarFoto, urlDeFotoValida } from "./fotos";
import { podeRegravar } from "./situacao";
import { validarSvg } from "./svg";

export type EntradaMaterial = {
  assuntoId: string;
  blocos: unknown;
  desenhos: { chave: string; svg: string; alt: string; legenda?: string }[];
  fotos: { chave: string; url: string; alt: string; legenda?: string; credito: string; licenca: string; fonte_url: string }[];
  fonte: "wikipedia" | "ia";
  fonte_titulo?: string;
  fonte_url?: string;
  exercicios: {
    enunciado: string;
    imagem?: string;
    alternativas: { letra: Letra; texto: string }[];
    resposta_correta: Letra;
    comentario: string;
  }[];
};

export const TOTAL_EXERCICIOS = 10;
const LETRAS = "ABCDE";

function ok<T>(r: { data: T | null; error: { message: string } | null }): T | null {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Confere tudo o que dá para conferir sem gravar nem baixar nada. */
function validar(e: EntradaMaterial) {
  if (e.exercicios.length !== TOTAL_EXERCICIOS) {
    throw new Error(`São necessários exatamente ${TOTAL_EXERCICIOS} exercícios (vieram ${e.exercicios.length}).`);
  }
  e.exercicios.forEach((x, n) => {
    if (x.alternativas.map((a) => a.letra).join("") !== LETRAS) {
      throw new Error(`Exercício ${n + 1}: as alternativas devem ser A, B, C, D e E, nessa ordem.`);
    }
  });
  const chaves = [...e.desenhos.map((d) => d.chave), ...e.fotos.map((f) => f.chave)];
  if (new Set(chaves).size !== chaves.length) throw new Error("Há chaves de imagem repetidas.");
  for (const d of e.desenhos) {
    const r = validarSvg(d.svg);
    if (!r.ok) throw new Error(`Desenho "${d.chave}" recusado: ${r.erro}.`);
  }
  for (const f of e.fotos) {
    if (!urlDeFotoValida(f.url)) throw new Error(`Foto "${f.chave}" recusada: só upload.wikimedia.org e thumb.wikimedia.org (https).`);
  }
  const chavesDesenho = new Set(e.desenhos.map((d) => d.chave));
  e.exercicios.forEach((x, n) => {
    if (x.imagem !== undefined && !chavesDesenho.has(x.imagem)) {
      throw new Error(`Exercício ${n + 1}: a figura "${x.imagem}" tem de ser a chave de um desenho (foto não vale).`);
    }
  });
  const blocos = validarBlocos(e.blocos, new Set(chaves));
  if (!blocos.ok) throw new Error(blocos.erro);
  return blocos.blocos;
}

async function apagarImagens(supabase: SupabaseClient, materialId: string) {
  const antigas = (ok(await supabase.from("imagens_estudo").select("id, storage_path").eq("material_id", materialId)) ?? []) as {
    id: string;
    storage_path: string | null;
  }[];
  const arquivos = antigas.map((i) => i.storage_path).filter((p): p is string => !!p);
  if (arquivos.length) await supabase.storage.from(BUCKET_ESTUDOS).remove(arquivos);
  ok(await supabase.from("exercicios_fixacao").delete().eq("material_id", materialId));
  ok(await supabase.from("imagens_estudo").delete().eq("material_id", materialId));
}

/**
 * Grava (ou regrava) o material de um assunto como rascunho, com imagens e os 10 exercícios.
 * Valida tudo antes de escrever; se um material novo falhar no meio, apaga o que criou, inclusive arquivos.
 */
export async function gravarMaterial(supabase: SupabaseClient, e: EntradaMaterial): Promise<{ materialId: string }> {
  const blocos = validar(e);

  const existente = ok(
    await supabase.from("materiais_estudo").select("id, situacao, checagens").eq("assunto_id", e.assuntoId).maybeSingle(),
  ) as Pick<MaterialEstudo, "id" | "situacao" | "checagens"> | null;
  if (!podeRegravar(existente)) {
    throw new Error("Este material não pode ser regravado: já foi publicado, está em conferência ou esgotou as checagens. Use o painel.");
  }

  const campos = {
    blocos,
    fonte: e.fonte,
    fonte_titulo: e.fonte_titulo ?? null,
    fonte_url: e.fonte_url ?? null,
    situacao: "rascunho" as const,
    motivo: null,
    checagem: null,
    checado_em: null,
    atualizado_em: new Date().toISOString(),
  };

  let materialId: string;
  let checagens = 0;
  if (existente) {
    materialId = existente.id;
    checagens = existente.checagens;
    await apagarImagens(supabase, materialId);
    ok(await supabase.from("materiais_estudo").update(campos).eq("id", materialId));
  } else {
    const criado = ok(
      await supabase.from("materiais_estudo").insert({ assunto_id: e.assuntoId, ...campos }).select("id").single(),
    ) as { id: string };
    materialId = criado.id;
  }

  const arquivos: string[] = [];
  try {
    const mapa: Record<string, string> = {};
    for (const d of e.desenhos) {
      const linha = ok(
        await supabase.from("imagens_estudo")
          .insert({ material_id: materialId, tipo: "desenho", svg: d.svg, alt: d.alt, legenda: d.legenda ?? null })
          .select("id").single(),
      ) as { id: string };
      mapa[d.chave] = linha.id;
    }
    for (const f of e.fotos) {
      const caminho = await gravarFoto(supabase, f.url, materialId);
      arquivos.push(caminho);
      const linha = ok(
        await supabase.from("imagens_estudo")
          .insert({
            material_id: materialId, tipo: "foto", storage_path: caminho, alt: f.alt, legenda: f.legenda ?? null,
            credito: f.credito, licenca: f.licenca, fonte_url: f.fonte_url,
          })
          .select("id").single(),
      ) as { id: string };
      mapa[f.chave] = linha.id;
    }
    ok(await supabase.from("materiais_estudo").update({ blocos: trocarImagens(blocos, mapa) }).eq("id", materialId));
    ok(
      await supabase.from("exercicios_fixacao").insert(
        e.exercicios.map((x, n) => ({
          material_id: materialId,
          ordem: n + 1,
          enunciado: x.enunciado,
          imagem_id: x.imagem !== undefined ? mapa[x.imagem] : null,
          alternativas: x.alternativas,
          resposta_correta: x.resposta_correta,
          comentario: x.comentario,
          situacao: "rascunho",
          checagens,
        })),
      ),
    );
  } catch (erro) {
    if (arquivos.length) await supabase.storage.from(BUCKET_ESTUDOS).remove(arquivos);
    if (!existente) {
      await supabase.from("exercicios_fixacao").delete().eq("material_id", materialId);
      await supabase.from("imagens_estudo").delete().eq("material_id", materialId);
      await supabase.from("materiais_estudo").delete().eq("id", materialId);
    }
    throw erro;
  }
  return { materialId };
}
