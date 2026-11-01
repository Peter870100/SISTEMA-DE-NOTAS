// Tipos da pré-visualização da prova no navegador. Puro e serializável: sem Buffer, sharp nem supabase.
import type { FiguraRef, QuestaoBase } from "./estrutura";

/** Figura pronta para a tela: `src` é um `data:image/png;base64,...` (ou null se não foi encontrada). */
export type FiguraTela = FiguraRef & { src: string | null; largura: number; altura: number };

export type DadosPrevia = {
  titulo: string;
  escola: string;
  logo: string | null;
  bolinhas: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  questoes: QuestaoBase<FiguraTela>[];
  avisoFinal: string | null;
};
