/** Registro das acoes da Hermes (tabela `hermes_registro`). */

const SENSIVEIS = /senha|token|telefone/i;
const MAX_TEXTO = 200;
const MAX_ITENS = 20;
const MAX_PROFUNDIDADE = 3;

/** Versao curta e segura dos parametros, para guardar no registro. Pura. */
export function resumirParametros(v: unknown, profundidade = 0): unknown {
  if (typeof v === "string") return v.length > MAX_TEXTO ? `${v.slice(0, MAX_TEXTO)}…` : v;
  if (v === null || typeof v !== "object") return v;
  if (profundidade >= MAX_PROFUNDIDADE) return "…";
  if (Array.isArray(v)) {
    const itens = v.slice(0, MAX_ITENS).map((x) => resumirParametros(x, profundidade + 1));
    return v.length > MAX_ITENS ? [...itens, `… e mais ${v.length - MAX_ITENS}`] : itens;
  }
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SENSIVEIS.test(k) ? "***" : resumirParametros(x, profundidade + 1)]),
  );
}

export type ContextoRegistro = { perfil: "dono" | "professor"; professorId: string | null; escolaId: string | null };

/** Grava `iniciada`, roda a acao e fecha o registro. Sem registro, a acao nao roda. */
export async function executarRegistrado<T>(ctx: ContextoRegistro, ferramenta: string, parametros: unknown, acao: () => Promise<T>): Promise<T> {
  const { supabase } = await import("@/lib/supabase/client");
  const { data, error } = await supabase
    .from("hermes_registro")
    .insert({ perfil: ctx.perfil, professor_id: ctx.professorId, escola_id: ctx.escolaId, ferramenta, parametros: resumirParametros(parametros) as Record<string, unknown>, situacao: "iniciada" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Não foi possível registrar a ação da Hermes: ${error?.message ?? "sem resposta"}`);
  try {
    const resultado = await acao();
    await supabase.from("hermes_registro").update({ situacao: "concluida", concluido_em: new Date().toISOString() }).eq("id", data.id);
    return resultado;
  } catch (e) {
    const mensagem = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await supabase.from("hermes_registro").update({ situacao: "erro", mensagem, concluido_em: new Date().toISOString() }).eq("id", data.id);
    throw e;
  }
}
