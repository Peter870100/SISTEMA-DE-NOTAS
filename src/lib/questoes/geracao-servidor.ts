import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { supabase } from "@/lib/supabase/client";
import { filtroVisivel } from "@/lib/simulados/servidor";
import type { Professor, Questao } from "@/lib/types";
import { podeVerQuestao } from "./acesso";
import { clienteIA, iaDisponivel, MODELO, PRECO_ENTRADA, PRECO_SAIDA } from "./ia";
import { MATERIAS, type Materia } from "./materias";
import {
  anoLocal, escolherExemplos, GeracaoSchema, inicioDoDia, instrucoesGeracao, LIMITE_DIARIO, respostaParaGeradas, restanteHoje, validarPedido,
  type CandidataExemplo, type PedidoGeracao, type Referencia, type RespostaGeracao,
} from "./geracao";

/**
 * Gerador de questões por IA com o ator explícito (sem cookie). Atualizar as telas fica com quem chama.
 */

export type ResultadoGeracao = { geracaoId: string; questoes: Questao[]; descartadas: number; custoUsd: number };

const MAX_CANDIDATAS = 200;
const MAX_RECENTES = 20;
const MAX_COM_BASE = 3;

/** Questões pedidas hoje pela escola (gerações em andamento ou concluídas; as com erro não contam). */
export async function pedidasHoje(escolaId: string, agora: Date = new Date()): Promise<number> {
  const { data, error } = await supabase
    .from("geracoes_ia")
    .select("quantidade_pedida")
    .eq("escola_id", escolaId)
    .in("status", ["gerando", "concluida"])
    .gte("created_at", inicioDoDia(agora).toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((soma, g) => soma + g.quantidade_pedida, 0);
}

function rotuloQuestao(q: Pick<Questao, "banca" | "ano" | "numero">): string {
  return [q.banca, q.ano ? String(q.ano) : "", q.numero !== null ? `nº ${q.numero}` : ""].filter(Boolean).join(" ");
}

type LinhaCandidata = Pick<Questao, "id" | "banca" | "ano" | "numero" | "assunto_id" | "enunciado" | "comando" | "alternativas" | "resposta">;

function paraCandidata(q: LinhaCandidata, comImagem: Set<string>): CandidataExemplo {
  return {
    id: q.id,
    rotulo: rotuloQuestao(q),
    assunto_id: q.assunto_id,
    enunciado: q.enunciado,
    comando: q.comando,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
    resposta: q.resposta,
    temImagem: comImagem.has(q.id),
  };
}

async function idsComImagem(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase.from("questao_imagens").select("questao_id").in("questao_id", ids);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((i) => i.questao_id));
}

/** Publicadas, não anuladas e visíveis ao ator, da matéria; com assunto, as dele vêm primeiro na leitura. */
async function candidatasExemplo(ator: Professor, materia: string, assuntoId: string | null, excluir: string | null): Promise<CandidataExemplo[]> {
  const ler = async (assunto: string | null) => {
    let c = supabase
      .from("questoes")
      .select("id, banca, ano, numero, assunto_id, enunciado, comando, alternativas, resposta")
      .eq("status", "publicada")
      .eq("anulada", false)
      .or(filtroVisivel(ator.escola_id))
      .eq("materia", materia);
    if (assunto) c = c.eq("assunto_id", assunto);
    const { data, error } = await c.limit(MAX_CANDIDATAS);
    if (error) throw new Error(error.message);
    return (data ?? []) satisfies LinhaCandidata[];
  };
  const linhas = assuntoId ? await ler(assuntoId) : [];
  if (linhas.length < 3) {
    const vistos = new Set(linhas.map((l) => l.id));
    linhas.push(...(await ler(null)).filter((l) => !vistos.has(l.id)));
  }
  const filtradas = linhas.filter((l) => l.id !== excluir);
  const comImagem = await idsComImagem(filtradas.map((l) => l.id));
  return filtradas.map((l) => paraCandidata(l, comImagem));
}

/** Começo do enunciado das últimas questões geradas no mesmo lugar (escola ou geral). */
async function recentesGeradas(ator: Professor, pedido: PedidoGeracao): Promise<string[]> {
  let c = supabase.from("questoes").select("enunciado").eq("origem", "ia").eq("materia", pedido.materia).eq("escopo", pedido.escopo);
  if (pedido.escopo === "escola") c = c.eq("escola_id", ator.escola_id);
  if (pedido.assunto_id) c = c.eq("assunto_id", pedido.assunto_id);
  const { data, error } = await c.order("created_at", { ascending: false }).limit(MAX_RECENTES);
  if (error) throw new Error(error.message);
  return (data ?? []).map((q) => q.enunciado.slice(0, 200));
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Lê a base (se houver), os assuntos aprovados da matéria e valida o pedido. */
async function prepararPedido(ator: Professor, bruto: unknown) {
  const cru = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  let entrada: Record<string, unknown> = { ...cru };
  let base: Questao | null = null;

  const baseId = texto(cru.base_id);
  if (baseId) {
    const { data, error } = await supabase.from("questoes").select("*").eq("id", baseId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !podeVerQuestao(ator, data)) throw new Error("Questão modelo não encontrada.");
    base = data;
    entrada = { ...entrada, materia: base.materia };
  }

  const materia = texto(entrada.materia);
  let assuntos: { id: string; nome: string }[] = [];
  if (materia) {
    const { data, error } = await supabase.from("assuntos").select("id, nome").eq("materia", materia).eq("situacao", "aprovado").order("nome");
    if (error) throw new Error(error.message);
    assuntos = data ?? [];
  }
  const aprovados = new Set(assuntos.map((a) => a.id));
  // Sem assunto no pedido, vale o da base (se for um assunto aprovado da matéria).
  if (base && !texto(entrada.assunto_id)) {
    entrada = { ...entrada, assunto_id: base.assunto_id && aprovados.has(base.assunto_id) ? base.assunto_id : null };
  }

  const pedido = validarPedido(entrada, ator, aprovados);
  return { pedido, base, assuntos, aprovados };
}

class ErroGeracao extends Error {}

// Só o esquema (sem o `parse` do SDK): assim a recusa ou a resposta cortada não estouram dentro do
// SDK antes de olharmos o stop_reason; a conferência com o zod é feita em `lerResposta`.
const { type: tipoFormato, schema: esquemaFormato } = betaZodOutputFormat(GeracaoSchema);
const FORMATO = { type: tipoFormato, schema: esquemaFormato };

function lerResposta(conteudo: Anthropic.Beta.BetaContentBlock[]): RespostaGeracao | null {
  const textoJson = conteudo.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const r = GeracaoSchema.safeParse(JSON.parse(textoJson));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// Prazo da chamada inteira (cabeçalhos + corpo do stream), abaixo do maxDuration (300 s) da página:
// o erro precisa cair no catch antes de a Vercel encerrar a função. O `timeout` do SDK só cobre até
// chegarem os cabeçalhos; quem corta o stream lento é o `signal`.
const TEMPO_IA_MS = 270_000;

async function pedirIA(instrucoes: string) {
  try {
    const stream = clienteIA().beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: FORMATO },
      messages: [{ role: "user", content: instrucoes }],
    }, { timeout: TEMPO_IA_MS, maxRetries: 0, signal: AbortSignal.timeout(TEMPO_IA_MS) });
    return await stream.finalMessage();
  } catch (e) {
    if (
      e instanceof Anthropic.APIConnectionTimeoutError ||
      e instanceof Anthropic.APIUserAbortError ||
      (e instanceof Error && e.name === "TimeoutError")
    ) {
      throw new ErroGeracao(MSG_DEMORA, { cause: e });
    }
    if (e instanceof Anthropic.APIError) throw new ErroGeracao(MSG_API, { cause: e });
    throw e;
  }
}

const MSG_RECUSA = "A IA recusou esse pedido. Tente reformular a orientação.";
const MSG_INCOMPLETA = "A resposta da IA veio incompleta. Tente uma quantidade menor.";
const MSG_FORMATO = "A IA devolveu um formato inválido. Tente de novo.";
const MSG_NENHUMA = "Nenhuma questão gerada passou na conferência. Tente de novo.";
const MSG_DEMORA = "A IA demorou demais. Tente uma quantidade menor.";
const MSG_API = "Não foi possível falar com a IA agora. Tente de novo em alguns minutos.";

export async function gerarQuestoesPor(ator: Professor, bruto: unknown): Promise<ResultadoGeracao> {
  if (!iaDisponivel()) throw new Error("A IA não está configurada (ANTHROPIC_API_KEY na Vercel).");
  const { pedido, base, assuntos, aprovados } = await prepararPedido(ator, bruto);

  const agora = new Date();
  const pedidas = await pedidasHoje(ator.escola_id, agora);
  const restante = restanteHoje(pedidas, ator.role);
  if (restante !== null && restante < pedido.quantidade) {
    throw new Error(
      `A escola já pediu ${pedidas} questões hoje; o limite é ${LIMITE_DIARIO} por dia.` +
        (restante > 0 ? ` Ainda dá para gerar ${restante}.` : ""),
    );
  }

  const { data: geracao, error: erroGeracao } = await supabase
    .from("geracoes_ia")
    .insert({
      escola_id: ator.escola_id,
      professor_id: ator.id,
      escopo: pedido.escopo,
      materia: pedido.materia,
      assunto_id: pedido.assunto_id,
      dificuldade: pedido.dificuldade,
      orientacao: pedido.orientacao,
      questao_base_id: base?.id ?? null,
      quantidade_pedida: pedido.quantidade,
      status: "gerando",
    })
    .select("id")
    .single();
  if (erroGeracao || !geracao) throw new Error(erroGeracao?.message ?? "Não foi possível começar a geração.");
  const geracaoId = geracao.id;

  let questoes: Questao[];
  let descartadas: number;
  let uso: { tokens_entrada: number; tokens_saida: number; custo_usd: number } | null = null;
  try {
    const materia = pedido.materia as Materia;
    const candidatas = await candidatasExemplo(ator, materia, pedido.assunto_id, base?.id ?? null);
    const escolhidos = escolherExemplos(candidatas, pedido.assunto_id);
    // Com base: ela é o modelo principal e vão só até 3 exemplos do mesmo assunto.
    const exemplos = base
      ? escolhidos.filter((c) => pedido.assunto_id === null || c.assunto_id === pedido.assunto_id).slice(0, MAX_COM_BASE)
      : escolhidos;
    const baseExemplo = base ? paraCandidata(base, new Set()) : null;
    const recentes = await recentesGeradas(ator, pedido);

    const instrucoes = instrucoesGeracao({
      pedido,
      materiaRotulo: MATERIAS[materia].rotulo,
      assuntoNome: assuntos.find((a) => a.id === pedido.assunto_id)?.nome ?? null,
      assuntos,
      exemplos,
      base: baseExemplo,
      recentes,
    });

    const msg = await pedirIA(instrucoes);
    const u = msg.usage;
    const entrada = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    uso = {
      tokens_entrada: entrada,
      tokens_saida: u.output_tokens,
      custo_usd: Math.round((entrada * PRECO_ENTRADA + u.output_tokens * PRECO_SAIDA) * 10000) / 10000,
    };
    if (msg.stop_reason === "refusal") throw new ErroGeracao(MSG_RECUSA);
    if (msg.stop_reason === "max_tokens") throw new ErroGeracao(MSG_INCOMPLETA);
    const lida = lerResposta(msg.content);
    if (!lida) throw new ErroGeracao(MSG_FORMATO);

    const referencias: Referencia[] = [
      ...(baseExemplo ? [baseExemplo] : []),
      ...exemplos,
    ].map((e) => ({ rotulo: e.rotulo, texto: `${e.enunciado} ${e.comando}` }));
    referencias.push(...recentes.map((r) => ({ rotulo: "uma questão gerada antes", texto: r })));

    const convertidas = respostaParaGeradas(lida, {
      escopo: pedido.escopo,
      escola_id: pedido.escopo === "geral" ? null : ator.escola_id,
      materia,
      assuntoPedido: pedido.assunto_id,
      assuntosValidos: aprovados,
      referencias,
      geracao_id: geracaoId,
      criado_por: ator.id,
      ano: anoLocal(agora),
    });
    if (convertidas.linhas.length === 0) throw new ErroGeracao(MSG_NENHUMA);

    const { data: gravadas, error: erroGravar } = await supabase.from("questoes").insert(convertidas.linhas).select("*");
    if (erroGravar) throw new Error(erroGravar.message);
    questoes = gravadas ?? [];
    descartadas = convertidas.descartadas;
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    const motivo = e instanceof ErroGeracao && e.cause instanceof Error ? `${erro} (${e.cause.message})` : erro;
    await supabase.from("geracoes_ia").update({ status: "erro", erro: motivo, ...(uso ?? {}) }).eq("id", geracaoId);
    throw e instanceof Error ? e : new Error(erro);
  }

  // As questões já estão gravadas: uma falha aqui só deixa a geração sem o resumo.
  const { error: erroConcluir } = await supabase
    .from("geracoes_ia")
    .update({ status: "concluida", quantidade_gerada: questoes.length, ...uso })
    .eq("id", geracaoId);
  if (erroConcluir) console.error("Gerador IA: não foi possível concluir a geração", geracaoId, erroConcluir.message);

  return { geracaoId, questoes, descartadas, custoUsd: uso?.custo_usd ?? 0 };
}
