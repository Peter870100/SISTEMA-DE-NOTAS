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

// ---------- tela "Feito pela Hermes" ----------

const MAX_PARAMETROS_TELA = 300;
const MINUTOS_SEM_CONFIRMACAO = 5;

/** Parâmetros já resumidos → "chave: valor · chave: valor", em texto puro e com tamanho limitado. Pura. */
export function textoParametros(p: unknown, max = MAX_PARAMETROS_TELA): string {
  if (p === null || typeof p !== "object" || Array.isArray(p)) return "";
  const valor = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const s = Object.entries(p as Record<string, unknown>).map(([k, v]) => `${k}: ${valor(v)}`).join(" · ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export type SituacaoTela = "iniciada" | "concluida" | "erro" | "sem_confirmacao";

/** 'iniciada' há mais de 5 minutos não está mais em andamento: a ação não confirmou o fim. Pura. */
export function situacaoNaTela(situacao: "iniciada" | "concluida" | "erro", criadoEm: string, agora = Date.now()): SituacaoTela {
  if (situacao !== "iniciada") return situacao;
  return agora - Date.parse(criadoEm) > MINUTOS_SEM_CONFIRMACAO * 60_000 ? "sem_confirmacao" : "iniciada";
}

export type ContextoRegistro = { perfil: "dono" | "professor"; professorId: string | null; escolaId: string | null };

/** Quem grava o registro (injetável para testar sem banco). */
export type GravadorRegistro = {
  iniciar(linha: { perfil: ContextoRegistro["perfil"]; professor_id: string | null; escola_id: string | null; ferramenta: string; parametros: Record<string, unknown> }): Promise<string>;
  fechar(id: string, campos: { situacao: "concluida" | "erro"; mensagem?: string; concluido_em: string }): Promise<void>;
};

async function gravadorSupabase(): Promise<GravadorRegistro> {
  const { supabase } = await import("@/lib/supabase/client");
  return {
    async iniciar(linha) {
      const { data, error } = await supabase.from("hermes_registro").insert({ ...linha, situacao: "iniciada" }).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "sem resposta");
      return data.id as string;
    },
    async fechar(id, campos) {
      const { error } = await supabase.from("hermes_registro").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

/** Fechar o registro nunca muda o resultado da ação: a falha só vai para o log. */
async function fecharSemFalhar(gravador: GravadorRegistro, id: string, campos: Parameters<GravadorRegistro["fechar"]>[1]) {
  try {
    await gravador.fechar(id, campos);
  } catch (e) {
    console.error(`hermes_registro ${id}: não foi possível marcar '${campos.situacao}':`, e instanceof Error ? e.message : e);
  }
}

/**
 * Grava `iniciada`, roda a acao e fecha o registro. Sem registro, a acao nao roda.
 * Se a ação deu certo, devolve o resultado mesmo que o fechamento falhe (senão a Hermes repetiria a ação);
 * se deu erro, relança o erro original da ação.
 */
export async function executarRegistrado<T>(ctx: ContextoRegistro, ferramenta: string, parametros: unknown, acao: () => Promise<T>, gravador?: GravadorRegistro): Promise<T> {
  const g = gravador ?? (await gravadorSupabase());
  let id: string;
  try {
    id = await g.iniciar({ perfil: ctx.perfil, professor_id: ctx.professorId, escola_id: ctx.escolaId, ferramenta, parametros: resumirParametros(parametros) as Record<string, unknown> });
  } catch (e) {
    throw new Error(`Não foi possível registrar a ação da Hermes: ${e instanceof Error ? e.message : String(e)}`);
  }
  let resultado: T;
  try {
    resultado = await acao();
  } catch (e) {
    const mensagem = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await fecharSemFalhar(g, id, { situacao: "erro", mensagem, concluido_em: new Date().toISOString() });
    throw e;
  }
  await fecharSemFalhar(g, id, { situacao: "concluida", concluido_em: new Date().toISOString() });
  return resultado;
}
