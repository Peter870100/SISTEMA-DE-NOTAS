"use server";

import { revalidatePath } from "next/cache";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { avatarValido, fotoAvatarValida } from "@/lib/avatar-aluno";

export async function salvarAvatarAluno(valor: string): Promise<{ erro?: string; avatar?: string }> {
  const aluno = await getAlunoAtual();
  if (!aluno) return { erro: "Entre novamente para salvar seu perfil." };
  if (!avatarValido(valor)) return { erro: "Escolha um emoji ou uma foto válida." };
  if (fotoAvatarValida(valor)) {
    const bytes = Buffer.from(valor.slice("data:image/jpeg;base64,".length), "base64");
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) {
      return { erro: "A foto está inválida. Escolha outra imagem." };
    }
  }
  const { data, error } = await supabase.from("alunos_contas")
    .update({ avatar_perfil: valor || null }).eq("id", aluno.id).eq("escola_id", aluno.escola_id)
    .select("avatar_perfil").single();
  if (error || !data) {
    return { erro: error?.code === "PGRST204" || error?.code === "42703"
      ? "O perfil ainda precisa ser ativado no banco de dados. Avise o administrador."
      : "Não foi possível salvar seu perfil. Tente novamente." };
  }
  revalidatePath("/aluno", "layout");
  return { avatar: data.avatar_perfil ?? "" };
}
