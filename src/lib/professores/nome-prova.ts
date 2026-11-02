import { supabase } from "@/lib/supabase/client";
import { validarNomeProva } from "@/lib/folha/editar-prova";

/**
 * "Nome na prova" (apelido) do professor, guardado em `professores.nome_prova`. A coluna é colada à mão
 * no banco: enquanto ela não existe, a leitura devolve null (sai o nome normal) e a gravação avisa.
 */

export const ERRO_FALTA_COLUNA_NOME_PROVA = "O nome na prova ainda não pode ser salvo: falta atualizar o banco.";

function faltaColuna(error: { code?: string; message: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204" || /nome_prova/i.test(error.message);
}

/** Nome e apelido do professor; null se ele não existe. Sem a coluna no banco, `nome_prova` vem null. */
export async function lerNomesProfessor(id: string): Promise<{ nome: string; nome_prova: string | null } | null> {
  const { data, error } = await supabase.from("professores").select("nome, nome_prova").eq("id", id).maybeSingle();
  if (!error) return data ? { nome: data.nome, nome_prova: data.nome_prova ?? null } : null;
  if (!faltaColuna(error)) throw new Error(error.message);
  const { data: so, error: errNome } = await supabase.from("professores").select("nome").eq("id", id).maybeSingle();
  if (errNome) throw new Error(errNome.message);
  return so ? { nome: so.nome, nome_prova: null } : null;
}

/** Apelidos de vários professores (id → nome_prova); vazio se a coluna ainda não existe. */
export async function nomesProvaPorId(ids: string[]): Promise<Record<string, string | null>> {
  const mapa: Record<string, string | null> = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from("professores").select("id, nome_prova").in("id", ids.slice(i, i + 150));
    if (error) {
      if (faltaColuna(error)) return {};
      throw new Error(error.message);
    }
    for (const p of data ?? []) mapa[p.id] = p.nome_prova ?? null;
  }
  return mapa;
}

/**
 * Valida (trim, até 60; em branco = null) e grava o apelido do professor `professorId`. Quem chama
 * decide de quem é o id (o próprio professor da sessão, ou o admin com o alvo já conferido).
 */
export async function gravarNomeProva(professorId: string, texto: string): Promise<string | null> {
  const v = validarNomeProva(texto);
  if (!v.ok) throw new Error(v.erro);
  const { error } = await supabase.from("professores").update({ nome_prova: v.valor }).eq("id", professorId);
  if (error) throw new Error(faltaColuna(error) ? ERRO_FALTA_COLUNA_NOME_PROVA : error.message);
  return v.valor;
}
