"use server";

import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { normalizarCodigo } from "@/lib/codigo-convite";
import { vincularContaAoConvite, type ConviteValido } from "@/lib/convites";

/** Convite ativo e dentro da validade para o código digitado (em qualquer formato), ou null. */
export async function buscarConviteValido(codigoDigitado: string): Promise<ConviteValido | null> {
  const codigo = normalizarCodigo(codigoDigitado);
  if (codigo.length !== 6) return null;
  const { data } = await supabase
    .from("convites_turma")
    .select("id, codigo, escola_id, turma_nome, ano_letivo, expira_em, ativo, escolas(nome)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!data || !data.ativo) return null;
  if (data.expira_em && new Date(data.expira_em) < new Date()) return null;
  const escola = data.escolas as unknown as { nome: string } | null;
  return {
    id: data.id,
    codigo: data.codigo,
    escola_id: data.escola_id,
    escola_nome: escola?.nome ?? "",
    turma_nome: data.turma_nome,
    ano_letivo: data.ano_letivo,
  };
}

/** Aluno já logado digita um código novo para entrar em outra turma. */
export async function entrarEmTurmaComCodigo(formData: FormData): Promise<void> {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const convite = await buscarConviteValido(String(formData.get("codigo") ?? ""));
  if (!convite || convite.escola_id !== aluno.escola_id) redirect("/aluno?erro=codigo");
  await vincularContaAoConvite(aluno.id, convite);
  redirect("/aluno?turma=ok");
}
