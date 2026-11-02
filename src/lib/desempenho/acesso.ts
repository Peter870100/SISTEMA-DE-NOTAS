import { correcaoLiberada } from "@/lib/simulados/regras";
import type { Simulado } from "@/lib/types";

/**
 * A atividade entra no painel? A escola (professor/admin) vê sempre; o aluno só vê o que já tem
 * correção liberada (treino e "na hora" sempre; "após o prazo" só depois de fechar).
 */
export function entraNoPainel(
  s: { tipo: "professor" | "treino"; correcao: string; fecha_em: string | null },
  agora: Date,
  visao: "aluno" | "escola",
): boolean {
  if (visao === "escola") return true;
  return correcaoLiberada(s as Pick<Simulado, "tipo" | "correcao" | "fecha_em">, agora);
}
