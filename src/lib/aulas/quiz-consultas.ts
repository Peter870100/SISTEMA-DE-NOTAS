import "server-only";
import { bancoQuiz, erroBancoQuiz } from "./quiz-banco";
import { perguntasParaAluno, QuizSchema, type QuizAlunoDados, type QuizProfessorDados } from "./quiz";

export async function quizDoProfessor(aulaId: string): Promise<QuizProfessorDados | null> {
  const { data, error } = await bancoQuiz().from("aula_quizzes").select("rascunho, publicado, atualizado_em").eq("aula_id", aulaId).maybeSingle();
  if (error) throw erroBancoQuiz(error);
  return data;
}
/** Called only after the page has checked access to this lesson. Never send the answer key. */
export async function quizDoAluno(aulaId: string, contaId: string): Promise<QuizAlunoDados | null> {
  const banco = bancoQuiz();
  const { data, error } = await banco.from("aula_quizzes").select("perguntas, versao").eq("aula_id", aulaId).eq("publicado", true).maybeSingle();
  if (error) throw erroBancoQuiz(error);
  if (!data) return null;
  const perguntas = QuizSchema.parse(data.perguntas);
  const { data: tentativa, error: erroTentativa } = await banco.from("aula_quiz_tentativas").select("resultado")
    .eq("aula_id", aulaId).eq("conta_id", contaId).eq("versao", data.versao).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (erroTentativa) throw erroBancoQuiz(erroTentativa);
  return { versao: data.versao, perguntas: perguntasParaAluno(perguntas), ultimoResultado: tentativa?.resultado ?? null };
}
