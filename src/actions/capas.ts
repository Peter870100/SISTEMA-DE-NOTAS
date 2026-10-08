"use server";
import { randomUUID } from "node:crypto";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { exigirCursoEditavel } from "@/lib/aulas/acesso";
import { armazenamentoCapas } from "@/lib/aulas/capas-armazenamento";
import { TIPOS_CAPA, validarCapa, type TipoCapa } from "@/lib/aulas/capas";
import { supabase } from "@/lib/supabase/client";
/** Devolve o erro como texto: em produção o Next esconde a mensagem de erros lançados por actions. */
export async function prepararEnvioCapa(tipo: TipoCapa, mime: string, tamanho: number, aulaId?: string): Promise<{ ok: true; caminho: string; url: string } | { ok: false; erro: string }> {
  try { return { ok: true, ...(await gerarEnvioCapa(tipo, mime, tamanho, aulaId)) }; }
  catch (e) { return { ok: false, erro: e instanceof Error && e.message ? e.message : "Não foi possível preparar o envio da imagem." }; }
}
async function gerarEnvioCapa(tipo: TipoCapa, mime: string, tamanho: number, aulaId?: string) {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  if (tipo !== "curso" && tipo !== "aula") throw new Error("Tipo de imagem inválido.");
  const erro = validarCapa(mime, tamanho);
  if (erro) throw new Error(erro);
  if (tipo === "aula") {
    const { data: aula } = await supabase.from("aulas").select("curso_id").eq("id", aulaId ?? "").maybeSingle();
    if (!aula) throw new Error("Aula não encontrada.");
    await exigirCursoEditavel(aula.curso_id);
  }
  const caminho = professor.escola_id + "/capas/" + professor.id + "/" + tipo + "-" + randomUUID() + "." + TIPOS_CAPA[mime as keyof typeof TIPOS_CAPA];
  const { data, error } = await armazenamentoCapas().createSignedUploadUrl(caminho);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o envio da imagem.");
  return { caminho, url: data.signedUrl };
}
