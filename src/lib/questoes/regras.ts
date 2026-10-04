import { ehAdmin } from "@/lib/papeis";
import type { Escopo, ProfessorRole, Questao } from "@/lib/types";

export type Ator = { id: string; role: ProfessorRole; escola_id: string };

export function podeEditarQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "criado_por">): boolean {
  if (ator.role === "dono") return true;
  if (q.escopo === "geral") return false;
  if (q.escola_id !== ator.escola_id) return false;
  return ehAdmin(ator.role) || q.criado_por === ator.id;
}

export function podeVerQuestao(ator: Ator, q: Pick<Questao, "escopo" | "escola_id" | "status" | "criado_por">): boolean {
  if (podeEditarQuestao(ator, q)) return true;
  if (q.status !== "publicada") return false;
  return q.escopo === "geral" || q.escola_id === ator.escola_id;
}

export function podeImportar(ator: Ator, escopo: Escopo): boolean {
  return escopo === "geral" ? ator.role === "dono" : ehAdmin(ator.role);
}
