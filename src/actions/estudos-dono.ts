"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { blocosVisiveis, validarBlocos, type Bloco } from "@/lib/estudos/blocos";
import { BUCKET_ESTUDOS } from "@/lib/estudos/fotos";
import { salvarExercicioCom, type CamposEditaveis, type DepsExercicio } from "@/lib/estudos/nucleo";
import { podeGerir } from "@/lib/estudos/situacao";
import type { Professor } from "@/lib/types";

type Resultado = { ok: true } | { ok: false; erro: string };
type Alvo = { materialId: string; exercicioId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LETRAS = ["A", "B", "C", "D", "E"] as const;
const LIMITE_MOTIVO = 500;

class Recusa extends Error {}

/** Só o dono mexe no estudo. Erro de regra vira `{ ok: false }`; o resto também, sem detalhe técnico. */
async function comDono(fn: (dono: Professor) => Promise<void>): Promise<Resultado> {
  try {
    const professor = await exigirProfessor();
    if (!podeGerir(professor.role)) return { ok: false, erro: "Só o dono da plataforma gerencia os estudos." };
    await fn(professor);
    revalidatePath("/banco/estudos", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Recusa) return { ok: false, erro: e.message };
    console.error("estudos-dono:", e);
    return { ok: false, erro: "Não foi possível salvar. Tente de novo." };
  }
}

function checar(erro: { message: string } | null) {
  if (erro) throw new Error(erro.message);
}

function exigirId(id: unknown, nome: string): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Recusa(`${nome} inválido.`);
}

function exigirAlvo(a: Alvo) {
  exigirId(a?.materialId, "Material");
  if (a.exercicioId !== null) exigirId(a.exercicioId, "Exercício");
}

async function situacaoDoAlvo(a: Alvo): Promise<string> {
  const consulta = a.exercicioId
    ? supabase.from("exercicios_fixacao").select("situacao").eq("id", a.exercicioId).eq("material_id", a.materialId)
    : supabase.from("materiais_estudo").select("situacao").eq("id", a.materialId);
  const { data, error } = await consulta.maybeSingle();
  checar(error);
  if (!data) throw new Recusa("Item não encontrado.");
  return data.situacao;
}

/** Fecha os avisos abertos do item (o texto é o aviso sem exercício). */
async function fecharAvisos(a: Alvo, situacao: "corrigido" | "sem_erro", dono: Professor) {
  let q = supabase
    .from("relatos_erro")
    .update({ situacao, resolvido_por: dono.id, resolvido_em: new Date().toISOString() })
    .eq("material_id", a.materialId)
    .eq("situacao", "aberto");
  q = a.exercicioId ? q.eq("exercicio_id", a.exercicioId) : q.is("exercicio_id", null);
  checar((await q).error);
}

/** Corrigi (texto): grava os blocos, publica direto, sem nova checagem, e fecha os avisos do texto. */
export async function salvarTextoEstudo(materialId: string, blocos: unknown): Promise<Resultado> {
  return comDono(async (dono) => {
    exigirId(materialId, "Material");
    const { data: material, error: eMat } = await supabase.from("materiais_estudo").select("id").eq("id", materialId).maybeSingle();
    checar(eMat);
    if (!material) throw new Recusa("Material não encontrado.");
    const { data: imgs, error } = await supabase.from("imagens_estudo").select("id").eq("material_id", materialId);
    checar(error);
    const v = validarBlocos(blocos, new Set((imgs ?? []).map((i) => i.id)));
    if (!v.ok) throw new Recusa(v.erro);
    const campos = { blocos: v.blocos, situacao: "publicado" as const, motivo: null, atualizado_em: new Date().toISOString() };
    const { error: eUp } = await supabase.from("materiais_estudo").update(campos).eq("id", materialId);
    checar(eUp);
    await fecharAvisos({ materialId, exercicioId: null }, "corrigido", dono);
  });
}

/** Corrigi (exercício). Mudou o que o aluno responde: as respostas dele são apagadas. */
export async function salvarExercicio(exercicioId: string, campos: CamposEditaveis): Promise<Resultado> {
  return comDono(async (dono) => {
    exigirId(exercicioId, "Exercício");
    if (campos?.imagem_id != null) exigirId(campos.imagem_id, "Figura");
    const deps: DepsExercicio = {
      ler: async (id) => {
        const { data, error } = await supabase.from("exercicios_fixacao").select("material_id, enunciado, imagem_id, alternativas, resposta_correta").eq("id", id).maybeSingle();
        checar(error);
        return data as Awaited<ReturnType<DepsExercicio["ler"]>>;
      },
      desenhoDoMaterial: async (imagemId, materialId) => {
        const { data, error } = await supabase.from("imagens_estudo").select("id, tipo").eq("id", imagemId).eq("material_id", materialId).maybeSingle();
        checar(error);
        return !!data && data.tipo === "desenho";
      },
      apagarRespostas: async (id) => { checar((await supabase.from("respostas_fixacao").delete().eq("exercicio_id", id)).error); },
      publicar: async (id, c) => { checar((await supabase.from("exercicios_fixacao").update(c).eq("id", id)).error); },
      fecharAvisos: (materialId, id) => fecharAvisos({ materialId, exercicioId: id }, "corrigido", dono),
    };
    const r = await salvarExercicioCom(deps, exercicioId, campos);
    if (!r.ok) throw new Recusa(r.erro);
  });
}

/** Tira do ar o que está publicado, com o motivo. Só o dono devolve. */
export async function retirarDoAr(alvo: Alvo, motivo: string): Promise<Resultado> {
  return comDono(async () => {
    exigirAlvo(alvo);
    const texto = typeof motivo === "string" ? motivo.trim() : "";
    if (!texto) throw new Recusa("Diga o motivo.");
    if (texto.length > LIMITE_MOTIVO) throw new Recusa(`O motivo pode ter no máximo ${LIMITE_MOTIVO} caracteres.`);
    if ((await situacaoDoAlvo(alvo)) !== "publicado") throw new Recusa("Só dá para retirar do ar o que está publicado.");
    const alteracao = { situacao: "em_conferencia" as const, motivo: texto };
    const { error } = alvo.exercicioId
      ? await supabase.from("exercicios_fixacao").update(alteracao).eq("id", alvo.exercicioId)
      : await supabase.from("materiais_estudo").update(alteracao).eq("id", alvo.materialId);
    checar(error);
  });
}

/** Não há erro: fecha os avisos como `sem_erro` e devolve o item ao ar. */
export async function semErro(alvo: Alvo): Promise<Resultado> {
  return comDono(async (dono) => {
    exigirAlvo(alvo);
    if ((await situacaoDoAlvo(alvo)) !== "em_conferencia") throw new Recusa("Este item não está em conferência.");
    const alteracao = { situacao: "publicado" as const, motivo: null };
    const { error } = alvo.exercicioId
      ? await supabase.from("exercicios_fixacao").update(alteracao).eq("id", alvo.exercicioId)
      : await supabase.from("materiais_estudo").update(alteracao).eq("id", alvo.materialId);
    checar(error);
    await fecharAvisos(alvo, "sem_erro", dono);
  });
}

export async function aprovarFoto(imagemId: string): Promise<Resultado> {
  return comDono(async (dono) => {
    exigirId(imagemId, "Foto");
    const { data, error } = await supabase
      .from("imagens_estudo")
      .update({ aprovada_por: dono.id, aprovada_em: new Date().toISOString() })
      .eq("id", imagemId)
      .eq("tipo", "foto")
      .select("id");
    checar(error);
    if (!data || data.length === 0) throw new Recusa("Foto não encontrada.");
  });
}

/** Apaga o arquivo e a linha, e tira a foto dos blocos; nenhum outro bloco muda. */
export async function recusarFoto(imagemId: string): Promise<Resultado> {
  return comDono(async () => {
    exigirId(imagemId, "Foto");
    const { data: foto, error } = await supabase.from("imagens_estudo").select("id, material_id, tipo, storage_path").eq("id", imagemId).maybeSingle();
    checar(error);
    if (!foto || foto.tipo !== "foto") throw new Recusa("Foto não encontrada.");
    if (foto.storage_path) checar((await supabase.storage.from(BUCKET_ESTUDOS).remove([foto.storage_path])).error);
    checar((await supabase.from("imagens_estudo").delete().eq("id", imagemId)).error);

    const [{ data: material, error: eMat }, { data: restantes, error: eRest }] = await Promise.all([
      supabase.from("materiais_estudo").select("blocos").eq("id", foto.material_id).maybeSingle(),
      supabase.from("imagens_estudo").select("id").eq("material_id", foto.material_id),
    ]);
    checar(eMat);
    checar(eRest);
    if (!material) return;
    // As outras imagens ficam todas no conjunto (inclusive fotos ainda sem aprovação): só a recusada some dos blocos.
    const blocos = blocosVisiveis(material.blocos as Bloco[], new Set((restantes ?? []).map((i) => i.id)));
    const campos = { blocos, atualizado_em: new Date().toISOString() };
    checar((await supabase.from("materiais_estudo").update(campos).eq("id", foto.material_id)).error);
  });
}

export async function marcarLido(materialId: string): Promise<Resultado> {
  return comDono(async (dono) => {
    exigirId(materialId, "Material");
    const { data, error } = await supabase
      .from("materiais_estudo")
      .update({ lido_por: dono.id, lido_em: new Date().toISOString() })
      .eq("id", materialId)
      .select("id");
    checar(error);
    if (!data || data.length === 0) throw new Recusa("Material não encontrado.");
  });
}
