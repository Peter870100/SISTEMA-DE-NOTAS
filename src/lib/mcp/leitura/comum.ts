import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizarBusca } from "@/lib/hermes/relatorios";
import { emBlocos } from "@/lib/simulados/regras";
import { podeVerTurma, type Escopo } from "../escopo";

/** O que toda ferramenta de leitura recebe: o banco e o alcance de quem perguntou. */
export type Ctx = { supabase: SupabaseClient; escopo: Escopo };
export type EscolaInfo = { id: string; nome: string; slug: string };

export const campoEscola = {
  escola: z.string().optional().describe("Só para o dono: nome ou slug da escola. Sem ela, vale para todas. Ignorado no perfil professor."),
};
export const campoTelefone = {
  professor_telefone: z.string().optional().describe("Telefone de quem pergunta (obrigatório no perfil professor)."),
};

export function texto(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lê todas as páginas de uma consulta (o PostgREST devolve no máximo 1000 linhas por vez). */
export async function lerTodas<T>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return todas;
  }
}

/** Mesmo que lerTodas, mas quebrando uma lista grande de ids em blocos (limite de URL do `.in()`). */
export async function lerPorIds<T>(ids: string[], montar: (bloco: string[], de: number, ate: number) => Resposta<T>): Promise<T[]> {
  const unicos = [...new Set(ids)];
  const saida: T[] = [];
  for (const bloco of emBlocos(unicos, 100)) saida.push(...(await lerTodas<T>((de, ate) => montar(bloco, de, ate))));
  return saida;
}

/** Escolas no alcance do pedido: professor = só a dele; dono = todas, ou a indicada por nome/slug. */
export async function escolasDoPedido(ctx: Ctx, escola?: string): Promise<EscolaInfo[]> {
  const { supabase, escopo } = ctx;
  if (escopo.tipo === "professor") {
    const { data, error } = await supabase.from("escolas").select("id, nome, slug").eq("id", escopo.escolaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Escola do professor não encontrada.");
    return [data as EscolaInfo];
  }
  const { data, error } = await supabase.from("escolas").select("id, nome, slug").order("nome");
  if (error) throw new Error(error.message);
  return filtrarEscolas((data ?? []) as EscolaInfo[], escola);
}

/** Escolas pelo nome ou slug (igual primeiro; senão quem contém). Sem nome, todas. Nenhuma achada → erro. Pura. */
export function filtrarEscolas(todas: EscolaInfo[], escola?: string): EscolaInfo[] {
  if (!escola?.trim()) return todas;
  const alvo = normalizarBusca(escola);
  const exatas = todas.filter((e) => normalizarBusca(e.slug) === alvo || normalizarBusca(e.nome) === alvo);
  const achadas = exatas.length ? exatas : todas.filter((e) => normalizarBusca(e.nome).includes(alvo) || normalizarBusca(e.slug).includes(alvo));
  if (achadas.length === 0) throw new Error(`Escola "${escola}" não encontrada. Escolas: ${todas.map((e) => e.nome).join(", ")}.`);
  return achadas;
}

/** Nome da escola para prefixar linhas quando o resultado mistura escolas. */
export function rotuloEscola(escolas: EscolaInfo[], escolaId: string | null): string {
  if (escolas.length <= 1) return "";
  return `[${escolas.find((e) => e.id === escolaId)?.nome ?? "geral"}] `;
}

export type TurmaAno = { escola_id: string; turma_nome: string; ano_letivo: string };
export const chaveTurma = (t: TurmaAno) => `${t.escola_id}|${t.turma_nome}|${t.ano_letivo}`;

/** Contas de aluno ligadas às turmas informadas (só as que o escopo vê). Devolve conta → turmas. */
export async function contasDasTurmas(ctx: Ctx, turmas: TurmaAno[]): Promise<Map<string, { nome: string; turmas: TurmaAno[] }>> {
  const visiveis = turmas.filter((t) => podeVerTurma(ctx.escopo, t.escola_id, t.turma_nome));
  const vinculos: (TurmaAno & { conta_id: string })[] = [];
  for (const t of visiveis) {
    vinculos.push(...(await lerTodas<TurmaAno & { conta_id: string }>((de, ate) =>
      ctx.supabase.from("aluno_turmas").select("conta_id, escola_id, turma_nome, ano_letivo")
        .eq("escola_id", t.escola_id).eq("turma_nome", t.turma_nome).eq("ano_letivo", t.ano_letivo)
        .order("conta_id").range(de, ate))));
  }
  const nomes = new Map<string, string>();
  const contas = await lerPorIds<{ id: string; nome: string }>(vinculos.map((v) => v.conta_id), (bloco, de, ate) =>
    ctx.supabase.from("alunos_contas").select("id, nome").in("id", bloco).order("id").range(de, ate));
  for (const c of contas) nomes.set(c.id, c.nome);
  const saida = new Map<string, { nome: string; turmas: TurmaAno[] }>();
  for (const v of vinculos) {
    const nome = nomes.get(v.conta_id);
    if (!nome) continue;
    const item = saida.get(v.conta_id) ?? { nome, turmas: [] };
    item.turmas.push({ escola_id: v.escola_id, turma_nome: v.turma_nome, ano_letivo: v.ano_letivo });
    saida.set(v.conta_id, item);
  }
  return saida;
}

/** Escolhe por nome: igual (normalizado) primeiro; senão quem contém o texto. */
export function acharPorNome<T>(lista: T[], nome: (x: T) => string, busca: string): T[] {
  const alvo = normalizarBusca(busca);
  if (!alvo) return [];
  const iguais = lista.filter((x) => normalizarBusca(nome(x)) === alvo);
  return iguais.length ? iguais : lista.filter((x) => normalizarBusca(nome(x)).includes(alvo));
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const nota10 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Corta a lista para não estourar a resposta, avisando quantas ficaram de fora. */
export function limitarLinhas(linhas: string[], max: number, dica: string): string[] {
  if (linhas.length <= max) return linhas;
  return [...linhas.slice(0, max), `… e mais ${linhas.length - max}. ${dica}`];
}

/** Cada arquivo de ferramentas registra as suas; `obter` resolve o escopo a partir dos argumentos. */
export type ObterCtx = (args: { professor_telefone?: string }) => Promise<Ctx>;
export type Registrar = (server: McpServer, obter: ObterCtx) => void;
