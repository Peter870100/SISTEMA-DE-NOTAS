"use server";

import { revalidatePath } from "next/cache";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { REGRAS_PADRAO, validarRegras } from "@/lib/plano/regras";
import { gravarRegrasDaEscola } from "@/lib/plano/regras-servidor";
import type { RegrasAprendizagem } from "@/lib/plano/tipos";

type Resultado = { ok: true; regras: RegrasAprendizagem } | { ok: false; erro: string };

const SEM_PERMISSAO = "Só a administração da escola pode mudar as regras.";
const FALHA = "Não foi possível salvar as regras.";

export async function salvarRegrasAprendizagem(entrada: unknown): Promise<Resultado> {
  try {
    const atual = await getProfessorAtual();
    if (!atual || !ehAdmin(atual.role)) return { ok: false, erro: SEM_PERMISSAO };
    const v = validarRegras(entrada);
    if (!v.ok) return { ok: false, erro: v.erro };
    await gravarRegrasDaEscola(atual.escola_id, v.regras);
    revalidatePath("/configuracoes");
    return { ok: true, regras: v.regras };
  } catch (e) {
    console.error("salvarRegrasAprendizagem", e);
    return { ok: false, erro: FALHA };
  }
}

export async function voltarRegrasPadrao(): Promise<Resultado> {
  try {
    const atual = await getProfessorAtual();
    if (!atual || !ehAdmin(atual.role)) return { ok: false, erro: SEM_PERMISSAO };
    await gravarRegrasDaEscola(atual.escola_id, null);
    revalidatePath("/configuracoes");
    return { ok: true, regras: { ...REGRAS_PADRAO } };
  } catch (e) {
    console.error("voltarRegrasPadrao", e);
    return { ok: false, erro: FALHA };
  }
}
