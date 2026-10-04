"use server";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual, getProfessorAtual } from "@/lib/auth";
import { exigirCursoEditavel, obterAulaParaAluno, podeEditarCurso } from "@/lib/aulas/acesso";
import { caminhoArquivo, validarArquivo } from "@/lib/aulas/arquivos";
import { gabaritoLiberado } from "@/lib/aulas/progresso";
import type { TipoArquivoAula } from "@/lib/types";

const VALIDADE_DOWNLOAD_SEG = 300;

async function aulaEditavel(aulaId: string) {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  const { curso } = await exigirCursoEditavel(aula.curso_id);
  return { aula, curso };
}

function tipoValido(tipo: string): tipo is TipoArquivoAula {
  return tipo === "material" || tipo === "gabarito";
}

export async function prepararEnvioArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number) {
  const { aula, curso } = await aulaEditavel(aulaId);
  if (!tipoValido(tipo)) throw new Error("Tipo de arquivo inválido.");
  const erro = validarArquivo(nome, tamanho);
  if (erro) throw new Error(erro);
  const storagePath = caminhoArquivo(curso.escola_id, curso.id, aula.id, randomUUID());
  const { data, error } = await supabase.storage.from("materiais").createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o envio.");
  return { signedUrl: data.signedUrl, storagePath };
}

export async function registrarArquivo(aulaId: string, tipo: TipoArquivoAula, nome: string, tamanho: number, storagePath: string): Promise<void> {
  const { aula, curso } = await aulaEditavel(aulaId);
  if (!tipoValido(tipo)) throw new Error("Tipo de arquivo inválido.");
  const erro = validarArquivo(nome, tamanho);
  if (erro) throw new Error(erro);
  if (!storagePath.startsWith(`${curso.escola_id}/${curso.id}/${aula.id}/`)) throw new Error("Caminho de arquivo inválido.");
  const { error } = await supabase
    .from("aula_arquivos")
    .insert({ aula_id: aula.id, tipo, nome_arquivo: nome.trim(), storage_path: storagePath, tamanho_bytes: Math.round(tamanho) });
  if (error) throw new Error(error.message);
}

export async function removerArquivo(arquivoId: string): Promise<void> {
  const { data: arquivo } = await supabase.from("aula_arquivos").select("*").eq("id", arquivoId).maybeSingle();
  if (!arquivo) return;
  await aulaEditavel(arquivo.aula_id);
  await supabase.storage.from("materiais").remove([arquivo.storage_path]);
  const { error } = await supabase.from("aula_arquivos").delete().eq("id", arquivoId);
  if (error) throw new Error(error.message);
}

/** Link de 5 minutos para baixar o PDF, depois de checar quem está pedindo. */
export async function linkDownloadArquivo(arquivoId: string): Promise<string> {
  const { data: arquivo } = await supabase.from("aula_arquivos").select("*").eq("id", arquivoId).maybeSingle();
  if (!arquivo) throw new Error("Arquivo não encontrado.");

  const professor = await getProfessorAtual();
  let permitido = false;
  if (professor) {
    const { data: aula } = await supabase.from("aulas").select("curso_id").eq("id", arquivo.aula_id).maybeSingle();
    const { data: curso } = aula ? await supabase.from("cursos").select("*").eq("id", aula.curso_id).maybeSingle() : { data: null };
    permitido = !!curso && podeEditarCurso(professor, curso);
  } else {
    const aluno = await getAlunoAtual();
    const acesso = aluno ? await obterAulaParaAluno(aluno, arquivo.aula_id) : null;
    if (aluno && acesso) {
      if (arquivo.tipo === "material") permitido = true;
      else {
        const { data: progresso } = await supabase
          .from("aula_progresso")
          .select("concluida_em")
          .eq("conta_id", aluno.id)
          .eq("aula_id", arquivo.aula_id)
          .maybeSingle();
        permitido = gabaritoLiberado(acesso.aula.gabarito_liberacao, acesso.aula.gabarito_libera_em, !!progresso?.concluida_em);
      }
    }
  }
  if (!permitido) throw new Error("Você não tem acesso a esse arquivo.");

  const { data, error } = await supabase.storage
    .from("materiais")
    .createSignedUrl(arquivo.storage_path, VALIDADE_DOWNLOAD_SEG, { download: arquivo.nome_arquivo });
  if (error || !data) throw new Error(error?.message ?? "Não foi possível gerar o link.");
  return data.signedUrl;
}
