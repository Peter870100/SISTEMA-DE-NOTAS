import { supabase } from "@/lib/supabase/client";
import { mesmaEscola } from "@/lib/escola-regras";
import type { AtorEscola } from "./ator";
import { regraNovaTentativa } from "./regras";
import { corrigirTentativa, entregarTentativa } from "./servidor";

/**
 * Ajuda ao aluno nas tentativas, com o ator explícito (a Hermes passa o dono com a escola do pedido).
 * A tentativa é sempre conferida pela escola do simulado dela.
 */

export { regraNovaTentativa } from "./regras";

const ERRO_TENTATIVA = "Tentativa não encontrada.";

type TentativaDaEscola = { id: string; status: string; prazo_em: string | null };

/** A tentativa, se o simulado dela é da escola do ator; senão "Tentativa não encontrada.". */
async function tentativaDaEscola(ator: AtorEscola, tentativaId: string): Promise<TentativaDaEscola> {
  const { data: t, error } = await supabase.from("tentativas").select("id, simulado_id, status, prazo_em").eq("id", tentativaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error(ERRO_TENTATIVA);
  const { data: s, error: erroS } = await supabase.from("simulados").select("escola_id").eq("id", t.simulado_id).maybeSingle();
  if (erroS) throw new Error(erroS.message);
  if (!s || !mesmaEscola(s, ator.escola_id)) throw new Error(ERRO_TENTATIVA);
  return { id: t.id, status: t.status, prazo_em: t.prazo_em };
}

/**
 * Manda a tentativa para a Lixeira (restaurável), e o aluno pode fazer de novo. Em andamento com o
 * aluno ainda no prazo, recusa, a menos que `mesmoEmAndamento`. Devolve o id do item na Lixeira.
 */
export async function liberarNovaTentativaPor(ator: AtorEscola, tentativaId: string, mesmoEmAndamento = false): Promise<string> {
  const t = await tentativaDaEscola(ator, tentativaId);
  const recusa = regraNovaTentativa(t, new Date(), mesmoEmAndamento);
  if (recusa) throw new Error(recusa);
  const { data, error } = await supabase.rpc("lixeira_excluir", { p_tipo: "tentativa", p_id: t.id, p_ator: ator.id, p_via: ator.via });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível mandar a tentativa para a Lixeira.");
  return data as string;
}

/** Entrega e corrige uma tentativa travada (a mesma entrega da tela). */
export async function encerrarTentativaPor(ator: AtorEscola, tentativaId: string): Promise<void> {
  const t = await tentativaDaEscola(ator, tentativaId);
  if (t.status !== "em_andamento") throw new Error("Essa tentativa já foi entregue.");
  await entregarTentativa(t.id);
}

/** Corrige de novo uma tentativa entregue (ex.: depois de mudar o gabarito ou anular questão). */
export async function recorrigirTentativaPor(ator: AtorEscola, tentativaId: string): Promise<void> {
  const t = await tentativaDaEscola(ator, tentativaId);
  if (t.status !== "entregue") throw new Error("Essa tentativa ainda não foi entregue; encerre antes.");
  await corrigirTentativa(t.id);
}
