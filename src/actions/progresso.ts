"use server";

import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { calcularProgresso, porcentagemAula } from "@/lib/aulas/progresso";

export async function registrarProgresso(aulaId: string, posicaoSeg: number, duracaoSeg: number): Promise<{ porcentagem: number; concluida: boolean }> {
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
  // A duração é informada pelo professor; o valor do navegador só entra em aulas antigas, sem duração registrada.
  const duracaoConhecida = acesso.aula.duracao_seg;
  const duracao = duracaoConhecida ?? anterior?.duracao_seg ?? duracaoSeg;
  const novo = calcularProgresso(anterior ?? null, posicaoSeg, duracao);
  if (!novo) throw new Error("Duração do vídeo inválida.");
  if (duracaoConhecida == null && !anterior) novo.concluir = false;

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
      concluida_em,
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
