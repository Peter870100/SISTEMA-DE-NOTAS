import { z } from "zod";

const Texto = z.string().trim();
export const PerguntaQuizSchema = z.object({
  id: z.uuid(),
  enunciado: Texto.min(8).max(1500),
  alternativas: z.array(Texto.min(1).max(500)).length(4),
  correta: z.number().int().min(0).max(3),
  explicacao: Texto.min(5).max(2000),
}).strict();
export const QuizSchema = z.array(PerguntaQuizSchema).min(3).max(5)
  .refine(q => new Set(q.map(p => p.id)).size === q.length, "Perguntas repetidas.")
  .refine(q => q.every(p => new Set(p.alternativas.map(a => a.toLocaleLowerCase("pt-BR"))).size === 4), "Use alternativas diferentes.");
export const RascunhoQuizSchema = z.array(PerguntaQuizSchema.extend({
  enunciado: Texto.max(1500), alternativas: z.array(Texto.max(500)).length(4), explicacao: Texto.max(2000),
})).max(5);
export const PedidoQuizIASchema = z.object({
  fonte: Texto.min(100).max(30000), quantidade: z.number().int().min(3).max(5), dificuldade: z.enum(["facil", "media", "desafiadora"]),
}).strict();
export const GeracaoQuizSchema = z.object({ perguntas: z.array(PerguntaQuizSchema.omit({ id: true })).max(5) });
export type PerguntaQuiz = z.infer<typeof PerguntaQuizSchema>;
export type PerguntaQuizAluno = Omit<PerguntaQuiz, "correta" | "explicacao">;
export type PedidoQuizIA = z.infer<typeof PedidoQuizIASchema>;
export type ResultadoQuiz = {
  acertos: number; total: number; porcentagem: number;
  itens: (PerguntaQuiz & { marcada: number })[];
};
export type QuizAlunoDados = { versao: string; perguntas: PerguntaQuizAluno[]; ultimoResultado: ResultadoQuiz | null };
export type QuizProfessorDados = { rascunho: PerguntaQuiz[]; publicado: boolean; atualizado_em: string | null };
export function perguntasParaAluno(perguntas: PerguntaQuiz[]): PerguntaQuizAluno[] {
  return perguntas.map(({ id, enunciado, alternativas }) => ({ id, enunciado, alternativas }));
}
export function corrigirQuiz(perguntas: PerguntaQuiz[], respostas: unknown): ResultadoQuiz {
  const marcadas = z.array(z.number().int().min(0).max(3)).length(perguntas.length).parse(respostas);
  const itens = perguntas.map((p, i) => ({ ...p, marcada: marcadas[i] }));
  const acertos = itens.filter(p => p.marcada === p.correta).length;
  return { acertos, total: itens.length, porcentagem: Math.round(acertos * 100 / itens.length), itens };
}
