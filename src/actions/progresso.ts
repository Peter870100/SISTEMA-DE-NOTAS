"use server";

import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { calcularProgresso, porcentagemAula } from "@/lib/aulas/progresso";

export async function registrarProgresso(aulaId: string, posicaoSeg: number): Promise<{ porcentagem: number; concluida: boolean }> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  const acesso = await obterAulaParaAluno(aluno, aulaId);
  if (!acesso || !acesso.aula.video_id) throw new Error("Aula não encontrada.");

  const { data: anterior } = await supabase
    .from("aula_progresso")
    .select("*")
    .eq("conta_id", aluno.id)
    .eq("aula_id", aulaId)
    .maybeSingle();
  // Sem duração registrada pelo professor não dá para medir nem concluir: só guarda onde retomar.
  if (acesso.aula.duracao_seg == null) {
    const pos = Number.isFinite(posicaoSeg) ? Math.max(0, Math.round(posicaoSeg)) : 0;
    const { error: erroPos } = await supabase.from("aula_progresso").upsert(
      { conta_id: aluno.id, aula_id: aulaId, curso_id: acesso.curso.id, posicao_seg: pos, atualizado_em: new Date().toISOString() },
      { onConflict: "conta_id,aula_id" }
    );
    if (erroPos) throw new Error(erroPos.message);
    return { porcentagem: anterior?.concluida_em ? 100 : 0, concluida: !!anterior?.concluida_em };
  }
  const novo = calcularProgresso(anterior ?? null, posicaoSeg, acesso.aula.duracao_seg);
  if (!novo) throw new Error("Duração do vídeo inválida.");

  const agora = new Date().toISOString();
  const concluida_em = anterior?.concluida_em ?? (novo.concluir ? agora : null);
  const { error } = await supabase.from("aula_progresso").upsert(
    {
      conta_id: aluno.id,
      aula_id: aulaId,
      curso_id: acesso.curso.id,
      posicao_seg: novo.posicao_seg,
      maior_posicao_seg: novo.maior_posicao_seg,
      duracao_seg: novo.duracao_seg,
      ...(concluida_em ? { concluida_em } : {}),
      atualizado_em: agora,
    },
    { onConflict: "conta_id,aula_id" }
  );
  if (error) throw new Error(error.message);
  return { porcentagem: porcentagemAula({ ...novo, concluida_em }), concluida: !!concluida_em };
}

export async function concluirAulaSemVideo(aulaId: string): Promise<void> {
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  const acesso = await obterAulaParaAluno(aluno, aulaId);
  if (!acesso) throw new Error("Aula não encontrada.");
  if (acesso.aula.video_id) throw new Error("Essa aula tem vídeo: ela conclui ao assistir.");
  const agora = new Date().toISOString();
  const { error } = await supabase.from("aula_progresso").upsert(
    { conta_id: aluno.id, aula_id: aulaId, curso_id: acesso.curso.id, concluida_em: agora, atualizado_em: agora },
    { onConflict: "conta_id,aula_id" }
  );
  if (error) throw new Error(error.message);
}
