"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import { getAlunoAtual } from "@/lib/auth";
import { exigirCursoEditavel, obterAulaParaAluno } from "@/lib/aulas/acesso";
import { bancoQuiz, erroBancoQuiz } from "@/lib/aulas/quiz-banco";
import { corrigirQuiz, PedidoQuizIASchema, QuizSchema, RascunhoQuizSchema, type PerguntaQuiz, type PedidoQuizIA, type ResultadoQuiz } from "@/lib/aulas/quiz";
import { gerarRascunhoQuiz } from "@/lib/aulas/quiz-ia";

async function aulaEditavel(aulaId: string) {
  z.uuid().parse(aulaId);
  const { data: aula } = await supabase.from("aulas").select("id, curso_id, titulo").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  const { professor } = await exigirCursoEditavel(aula.curso_id);
  return { aula, professor };
}
export async function salvarQuizAula(aulaId: string, perguntas: PerguntaQuiz[], modo: "rascunho" | "publicar" | "retirar"): Promise<void> {
  const { aula } = await aulaEditavel(aulaId);
  if (!["rascunho", "publicar", "retirar"].includes(modo)) throw new Error("Operação inválida.");
  const banco = bancoQuiz();
  if (modo === "retirar") {
    const { error } = await banco.from("aula_quizzes").update({ publicado: false, atualizado_em: new Date().toISOString() }).eq("aula_id", aulaId);
    if (error) throw erroBancoQuiz(error);
  } else {
    const validacao = (modo === "publicar" ? QuizSchema : RascunhoQuizSchema).safeParse(perguntas);
    if (!validacao.success) throw new Error(modo === "publicar" ? "Preencha de 3 a 5 perguntas, quatro alternativas diferentes, a resposta correta e a explicação de cada uma." : "Revise o rascunho: use até cinco perguntas e respeite os limites dos campos.");
    const { error } = await banco.from("aula_quizzes").upsert({
      aula_id: aulaId, rascunho: validacao.data, atualizado_em: new Date().toISOString(),
      ...(modo === "publicar" ? { perguntas: validacao.data, publicado: true, versao: randomUUID() } : {}),
    }, { onConflict: "aula_id" });
    if (error) throw erroBancoQuiz(error);
  }
  revalidatePath(`/cursos/${aula.curso_id}/aulas/${aulaId}`);
  revalidatePath(`/aluno/aulas/${aulaId}`);
}

const geracoesRecentes = new Map<string, number>();
export async function gerarQuizComIA(aulaId: string, dados: PedidoQuizIA): Promise<PerguntaQuiz[]> {
  const { aula, professor } = await aulaEditavel(aulaId);
  const pedido = PedidoQuizIASchema.safeParse(dados);
  if (!pedido.success) throw new Error("Cole um texto de 100 a 30.000 caracteres e escolha de 3 a 5 perguntas.");
  const agora = Date.now();
  for (const [id, momento] of geracoesRecentes) if (agora - momento > 30000) geracoesRecentes.delete(id);
  if (geracoesRecentes.has(professor.id)) throw new Error("Aguarde alguns segundos antes de gerar novamente.");
  geracoesRecentes.set(professor.id, agora);
  try { return await gerarRascunhoQuiz(aula.titulo, pedido.data); }
  catch { throw new Error("Não foi possível gerar o quiz com IA. Verifique o material ou crie as perguntas manualmente. Se persistir, avise o administrador."); }
}

export async function responderQuizAula(aulaId: string, versao: string, respostas: number[]): Promise<ResultadoQuiz> {
  z.uuid().parse(aulaId); z.uuid().parse(versao);
  const aluno = await getAlunoAtual();
  if (!aluno) throw new Error("Faça login novamente.");
  if (!await obterAulaParaAluno(aluno, aulaId)) throw new Error("Aula não encontrada.");
  const { data: progresso, error: erroProgresso } = await supabase.from("aula_progresso").select("concluida_em").eq("aula_id", aulaId).eq("conta_id", aluno.id).maybeSingle();
  if (erroProgresso || !progresso?.concluida_em) throw new Error("Conclua a aula antes de responder ao quiz.");
  const banco = bancoQuiz();
  const { data: quiz, error } = await banco.from("aula_quizzes").select("perguntas, versao").eq("aula_id", aulaId).eq("publicado", true).eq("versao", versao).maybeSingle();
  if (error) throw erroBancoQuiz(error);
  if (!quiz) throw new Error("O professor atualizou este quiz. Recarregue a página para continuar.");
  const perguntas = QuizSchema.parse(quiz.perguntas);
  let resultado: ResultadoQuiz;
  try { resultado = corrigirQuiz(perguntas, respostas); }
  catch { throw new Error("Responda todas as perguntas antes de finalizar."); }
  const { error: erroSalvar } = await banco.from("aula_quiz_tentativas").insert({ aula_id: aulaId, conta_id: aluno.id, versao: quiz.versao, resultado });
  if (erroSalvar) throw erroBancoQuiz(erroSalvar);
  return resultado;
}
