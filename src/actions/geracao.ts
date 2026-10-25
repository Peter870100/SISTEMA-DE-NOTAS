"use server";

import { revalidatePath } from "next/cache";
import { exigirProfessor } from "@/lib/questoes/acesso";
import { restanteHoje } from "@/lib/questoes/geracao";
import { gerarQuestoesPor, pedidasHoje, type ResultadoGeracao } from "@/lib/questoes/geracao-servidor";

export async function gerarQuestoes(pedido: unknown): Promise<ResultadoGeracao> {
  const professor = await exigirProfessor();
  const resultado = await gerarQuestoesPor(professor, pedido);
  revalidatePath("/banco");
  return resultado;
}

/** Quantas questões a escola ainda pode gerar hoje; null = sem limite. */
export async function cotaDeHoje(): Promise<number | null> {
  const professor = await exigirProfessor();
  if (professor.role === "dono") return null;
  return restanteHoje(await pedidasHoje(professor.escola_id), professor.role);
}
