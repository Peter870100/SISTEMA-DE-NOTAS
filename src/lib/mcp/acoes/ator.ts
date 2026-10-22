import { z } from "zod";
import { executarRegistrado } from "@/lib/hermes/registro";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { TurmaSimulado } from "@/lib/simulados/configuracao";
import { acharPorNome, escolasDoPedido, texto, type Ctx, type EscolaInfo } from "../leitura/comum";

/**
 * Quem age nas ferramentas de escrita da Hermes, e as conversões de parâmetros.
 * Só lê do banco o necessário (id do dono, escolas); as regras ficam em funções puras testáveis.
 */

export const ERRO_OUTRA_ESCOLA = "Você só pode mexer na sua escola.";
/** Mesmas mensagens das telas para registros citados por id: não confirmam que o id existe em outra escola. */
export const ERRO_SIMULADO = "Simulado não encontrado.";
export const ERRO_QUESTAO = "Você não pode editar essa questão.";

/** O professor com role 'dono' (só `id` e `escola_id`). Precisa existir exatamente um. */
export async function contaDoDono(ctx: Ctx): Promise<{ id: string; escola_id: string }> {
  const { data, error } = await ctx.supabase.from("professores").select("id, escola_id").eq("role", "dono").limit(2);
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as { id: string; escola_id: string }[];
  if (linhas.length !== 1) throw new Error(`Era esperada exatamente uma conta de dono cadastrada (há ${linhas.length}).`);
  return linhas[0];
}

/**
 * Ator da Hermes na escola `escolaId`: o dono age em qualquer escola; o professor só na dele.
 * `erroOutraEscola` = mensagem quando o professor não é dessa escola (para um registro citado por id, a da tela).
 */
export async function atorDoEscopo(ctx: Ctx, escolaId: string, erroOutraEscola = ERRO_OUTRA_ESCOLA): Promise<AtorEscola> {
  const e = ctx.escopo;
  if (e.tipo === "professor") {
    if (escolaId !== e.escolaId) throw new Error(erroOutraEscola);
    return { id: e.professorId, role: e.papel ?? "professor", escola_id: escolaId, turmas: e.turmas, via: "hermes" };
  }
  const dono = await contaDoDono(ctx);
  return { id: dono.id, role: "dono", escola_id: escolaId, turmas: null, via: "hermes" };
}

/** Escolhe uma única escola pelo nome ou slug; sem nome, só vale se houver uma escola. Pura. */
export function escolherEscola(todas: EscolaInfo[], nome?: string): EscolaInfo {
  const pedir = (lista: EscolaInfo[]) => new Error(`Diga em qual escola: ${lista.map((x) => x.nome).join(", ")}.`);
  if (!nome?.trim()) {
    if (todas.length === 1) return todas[0];
    if (todas.length === 0) throw new Error("Nenhuma escola cadastrada.");
    throw pedir(todas);
  }
  const alvo = normalizarBusca(nome);
  const exatas = todas.filter((x) => normalizarBusca(x.slug) === alvo || normalizarBusca(x.nome) === alvo);
  const achadas = exatas.length ? exatas : todas.filter((x) => normalizarBusca(x.nome).includes(alvo) || normalizarBusca(x.slug).includes(alvo));
  if (achadas.length === 0) throw new Error(`Escola "${nome}" não encontrada. Escolas: ${todas.map((x) => x.nome).join(", ")}.`);
  if (achadas.length > 1) throw pedir(achadas);
  return achadas[0];
}

/** Escola onde algo novo será criado: a do professor; para o dono, exatamente uma escola pedida. */
export async function escolaParaCriar(ctx: Ctx, escola?: string): Promise<EscolaInfo> {
  if (ctx.escopo.tipo === "professor") return (await escolasDoPedido(ctx))[0];
  return escolherEscola(await escolasDoPedido(ctx), escola);
}

const FUSO_SP = "-03:00"; // São Paulo não tem horário de verão desde 2019.

/** "dd/mm/aaaa hh:mm" (horário de São Paulo) ou ISO → ISO em UTC. ISO sem fuso vale São Paulo. Pura. */
export function paraIsoSaoPaulo(valor: string): string {
  const s = valor.trim();
  const invalida = () => new Error(`Data inválida: "${valor}". Use dd/mm/aaaa hh:mm (horário de Brasília).`);
  let iso: string;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:h](\d{2})$/i.exec(s);
  if (br) {
    const [, d, m, a, h, min] = br;
    iso = `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min}:00${FUSO_SP}`;
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    iso = s.replace(" ", "T") + FUSO_SP;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    iso = s;
  } else {
    throw invalida();
  }
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw invalida();
  // Date.parse aceita 31/02 e "rola" para março: confere se o dia/hora local continuam os mesmos.
  const [, a, m, d, h, min] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)!;
  const offset = /(Z|[+-]\d{2}:?\d{2})$/i.exec(iso)![1];
  const minutosFuso = offset.toUpperCase() === "Z" ? 0 : (offset[0] === "-" ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(-2)));
  const local = new Date(t + minutosFuso * 60_000);
  if (local.getUTCFullYear() !== Number(a) || local.getUTCMonth() + 1 !== Number(m) || local.getUTCDate() !== Number(d)
    || local.getUTCHours() !== Number(h) || local.getUTCMinutes() !== Number(min)) throw invalida();
  return new Date(t).toISOString();
}

/**
 * Nomes de turma → turma + ano letivo (o mais recente daquele nome na escola). Pura.
 * `permitidas` = turmas liberadas para o professor (null = todas).
 */
export function resolverTurmas(nomes: string[], turmasEscola: { nome: string; ano_letivo: string }[], permitidas: Set<string> | null): TurmaSimulado[] {
  const distintos = [...new Set(turmasEscola.map((t) => t.nome))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const saida = new Map<string, TurmaSimulado>();
  for (const pedido of nomes) {
    const iguais = distintos.filter((n) => normalizarBusca(n) === normalizarBusca(pedido));
    const achados = iguais.length ? iguais : acharPorNome(distintos, (n) => n, pedido);
    if (achados.length === 0) throw new Error(`Turma não encontrada: "${pedido}". Turmas da escola: ${distintos.join(", ") || "nenhuma"}.`);
    if (achados.length > 1) throw new Error(`Mais de uma turma com "${pedido}": ${achados.join(", ")}. Diga qual.`);
    const nome = achados[0];
    if (permitidas && !permitidas.has(nome)) throw new Error(`Você não tem acesso à turma ${nome}.`);
    const ano = turmasEscola.filter((t) => t.nome === nome).map((t) => t.ano_letivo).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    saida.set(`${nome}|${ano}`, { turma_nome: nome, ano_letivo: ano });
  }
  return [...saida.values()];
}

// ---------- comum às ferramentas de escrita ----------

export type Perfil = "dono" | "professor";

/** Ids do banco (uuid). Recusa texto livre antes de chegar ao PostgREST. */
export const campoId = (descricao: string) => z.string().trim().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "id inválido").describe(descricao);

/** Erro de ferramenta: texto curto em pt-BR com isError. */
export function falha(verbo: string, e: unknown) {
  return { ...texto(`Não foi possível ${verbo}: ${e instanceof Error ? e.message : String(e)}`), isError: true };
}

/** Roda a ação do núcleo com registro em `hermes_registro`. */
export function registrado<T>(perfil: Perfil, ator: AtorEscola, ferramenta: string, parametros: unknown, acao: () => Promise<T>): Promise<T> {
  return executarRegistrado({ perfil, professorId: ator.id, escolaId: ator.escola_id }, ferramenta, parametros, acao);
}
