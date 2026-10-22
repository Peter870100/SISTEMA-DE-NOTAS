import { exigirNaoAluno, getProfessorAtual, turmasLiberadasPara } from "@/lib/auth";
import type { Ator } from "@/lib/questoes/regras";

/**
 * Quem age sobre simulados. `escola_id` é a escola onde a ação acontece (o dono pela Hermes recebe a
 * escola do pedido). `turmas` null = vê todas as turmas da escola.
 */
export type AtorEscola = Ator & { turmas: Set<string> | null; via: "app" | "hermes" };

/** O professor logado (cookie), com as turmas liberadas para ele. */
export async function atorDaSessao(): Promise<AtorEscola> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  return { id: professor.id, role: professor.role, escola_id: professor.escola_id, turmas: await turmasLiberadasPara(professor), via: "app" };
}
