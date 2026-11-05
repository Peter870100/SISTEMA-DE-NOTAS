/**
 * Montagem pura dos exercícios que o aluno vê. Sem acesso a banco (os testes importam este arquivo):
 * gabarito e comentário só saem para o exercício que a conta já respondeu.
 */
import type { Letra, SituacaoEstudo } from "../types";

export type ImagemTela = { id: string; src: string; alt: string; legenda: string | null; credito: string | null; licenca: string | null };

export type ExercicioTela = {
  id: string;
  ordem: number;
  enunciado: string;
  alternativas: { letra: Letra; texto: string }[];
  imagem: ImagemTela | null;
  resposta: { marcada: Letra; acertou: boolean; certa: Letra; comentario: string } | null;
};

export type LinhaExercicio = {
  id: string;
  ordem: number;
  enunciado: string;
  imagem_id: string | null;
  alternativas: { letra: Letra; texto: string }[];
  situacao: SituacaoEstudo;
};

export function exerciciosParaTela(
  linhas: LinhaExercicio[],
  respostas: Map<string, { marcada: Letra; acertou: boolean }> | null,
  gabaritos: Map<string, { resposta_correta: Letra; comentario: string }>,
  imagens: Record<string, ImagemTela>,
): ExercicioTela[] {
  return linhas
    .filter((e) => e.situacao === "publicado")
    .map((e) => {
      const feita = respostas?.get(e.id);
      const gab = feita ? gabaritos.get(e.id) : undefined;
      return {
        id: e.id,
        ordem: e.ordem,
        enunciado: e.enunciado,
        alternativas: e.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
        imagem: e.imagem_id ? imagens[e.imagem_id] ?? null : null,
        resposta: feita && gab ? { marcada: feita.marcada, acertou: feita.acertou, certa: gab.resposta_correta, comentario: gab.comentario } : null,
      };
    });
}
