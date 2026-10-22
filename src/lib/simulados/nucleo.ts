import { supabase } from "@/lib/supabase/client";
import { padraoExato } from "@/lib/questoes/busca";
import type { Simulado } from "@/lib/types";
import type { AtorEscola } from "./ator";
import { chaveTurma, limparConfiguracao, limparFiltros, mudancaProibidaComTentativas, validarOrdem, validarPublicacao, type DadosSimulado } from "./configuracao";
import { sortear } from "./regras";
import { candidatosSorteio, filtroVisivel, podeEditarSimulado, type FiltrosSorteio } from "./servidor";

/**
 * Regras de simulado com o ator explícito: a tela (ator da sessão) e a Hermes usam as mesmas funções.
 * Nada aqui lê cookie.
 */

const MAX_QUESTOES = 200;

export async function exigirSimuladoEditavelPor(ator: AtorEscola, simuladoId: string): Promise<{ simulado: Simulado }> {
  const { data: simulado } = await supabase.from("simulados").select("*").eq("id", simuladoId).maybeSingle();
  if (!simulado || !podeEditarSimulado(ator, simulado)) throw new Error("Simulado não encontrado.");
  return { simulado };
}

async function temTentativas(simuladoId: string): Promise<boolean> {
  const { count, error } = await supabase.from("tentativas").select("id", { count: "exact", head: true }).eq("simulado_id", simuladoId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function exigirQuestoesEditaveis(ator: AtorEscola, id: string) {
  const r = await exigirSimuladoEditavelPor(ator, id);
  if (await temTentativas(id)) throw new Error("Alunos já começaram: as questões não podem mais mudar.");
  return r;
}

async function idsDoSimulado(id: string): Promise<{ ids: string[]; proxima: number }> {
  const { data, error } = await supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", id).order("ordem");
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  return { ids: linhas.map((q) => q.questao_id), proxima: linhas.reduce((m, q) => Math.max(m, q.ordem + 1), 0) };
}

/** Turmas (nome|ano) da escola do ator que ele pode ver: a mesma regra de `turmasDaEscola`. */
async function turmasAcessiveis(ator: AtorEscola): Promise<Set<string>> {
  const { data, error } = await supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", ator.escola_id);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).filter((t) => ator.turmas === null || ator.turmas.has(t.nome)).map((t) => `${t.nome}|${t.ano_letivo}`));
}

/** Só turmas (nome+ano) que o ator pode acessar; mantém as já ligadas. */
async function gravarTurmas(ator: AtorEscola, simuladoId: string, escolaId: string, turmas: DadosSimulado["turmas"]) {
  const acessiveis = await turmasAcessiveis(ator);
  const { data: atuais, error: e0 } = await supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", simuladoId);
  if (e0) throw new Error(e0.message);
  const ja = new Set((atuais ?? []).map(chaveTurma));
  const validas = [...new Map(turmas.filter((t) => acessiveis.has(chaveTurma(t)) || ja.has(chaveTurma(t))).map((t) => [chaveTurma(t), t])).values()];
  const novas = validas.filter((t) => !ja.has(chaveTurma(t)));
  const chaves = new Set(validas.map(chaveTurma));
  const removidas = (atuais ?? []).filter((t) => !chaves.has(chaveTurma(t)));
  if (novas.length) {
    const { error } = await supabase.from("simulado_turmas").insert(novas.map((t) => ({ simulado_id: simuladoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
    if (error) throw new Error(error.message);
  }
  for (const t of removidas) {
    const { error } = await supabase.from("simulado_turmas").delete().eq("simulado_id", simuladoId).eq("turma_nome", t.turma_nome).eq("ano_letivo", t.ano_letivo);
    if (error) throw new Error(error.message);
  }
}

export async function criarSimuladoPor(ator: AtorEscola, d: DadosSimulado): Promise<string> {
  // 'app' é o padrão da coluna: só grava quando é a Hermes.
  const via = ator.via === "app" ? {} : { criado_via: ator.via };
  const { data, error } = await supabase.from("simulados").insert({ ...limparConfiguracao(d), ...via, escola_id: ator.escola_id, tipo: "professor", professor_id: ator.id, status: "rascunho" }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar simulado.");
  await gravarTurmas(ator, data.id, ator.escola_id, d.turmas);
  return data.id;
}

export async function salvarSimuladoPor(ator: AtorEscola, id: string, d: DadosSimulado): Promise<void> {
  const { simulado } = await exigirSimuladoEditavelPor(ator, id);
  const campos = limparConfiguracao(d);
  if (await temTentativas(id)) {
    const { data: ligadas, error: eL } = await supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", id);
    if (eL) throw new Error(eL.message);
    if (mudancaProibidaComTentativas(simulado, campos, ligadas ?? [], d.turmas)) throw new Error("Alunos já começaram: só é possível mudar título, correção, fechamento e acrescentar turmas.");
  }
  const { error } = await supabase.from("simulados").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await gravarTurmas(ator, id, simulado.escola_id, d.turmas);
  // Fechamento antecipado vale também para quem já está fazendo a prova.
  if (Date.parse(campos.fecha_em) !== Date.parse(simulado.fecha_em ?? "")) {
    const { error: ePrazo } = await supabase.from("tentativas").update({ prazo_em: campos.fecha_em }).eq("simulado_id", id).eq("status", "em_andamento").gt("prazo_em", campos.fecha_em);
    if (ePrazo) throw new Error(ePrazo.message);
  }
}

export async function sortearQuestoesPor(ator: AtorEscola, id: string, f: FiltrosSorteio & { quantidade: number; naoRepetir?: boolean }): Promise<{ adicionadas: number; pedidas: number; puladas: number }> {
  const { simulado } = await exigirQuestoesEditaveis(ator, id);
  const pedidas = Math.round(f.quantidade);
  if (!Number.isFinite(pedidas) || pedidas < 1 || pedidas > 200) throw new Error("Quantidade de 1 a 200.");
  const filtros = limparFiltros(f);
  const { ids: atuais, proxima } = await idsDoSimulado(id);
  const vagas = MAX_QUESTOES - atuais.length;
  if (vagas <= 0) throw new Error(`Um simulado pode ter no máximo ${MAX_QUESTOES} questões.`);
  const novas = sortear(await candidatosSorteio(simulado.escola_id, filtros, atuais), Math.min(pedidas, vagas));
  if (novas.length) {
    const { error } = await supabase.from("simulado_questoes").insert(novas.map((questao_id, i) => ({ simulado_id: id, questao_id, ordem: proxima + i })));
    if (error) throw new Error(error.message);
  }
  return { adicionadas: novas.length, pedidas, puladas: 0 };
}

export async function trocarQuestaoPor(ator: AtorEscola, id: string, questaoId: string, f: FiltrosSorteio): Promise<boolean> {
  const { simulado } = await exigirQuestoesEditaveis(ator, id);
  const filtros = limparFiltros(f);
  const { ids: atuais } = await idsDoSimulado(id);
  if (!atuais.includes(questaoId)) throw new Error("Questão não está no simulado.");
  const [nova] = sortear(await candidatosSorteio(simulado.escola_id, filtros, atuais), 1);
  if (!nova) return false;
  const { error } = await supabase.from("simulado_questoes").update({ questao_id: nova }).eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
  return true;
}

export async function removerQuestaoPor(ator: AtorEscola, id: string, questaoId: string): Promise<void> {
  await exigirQuestoesEditaveis(ator, id);
  const { error } = await supabase.from("simulado_questoes").delete().eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
}

export async function adicionarQuestaoPor(ator: AtorEscola, id: string, questaoId: string): Promise<void> {
  const { simulado } = await exigirQuestoesEditaveis(ator, id);
  const { data: q } = await supabase.from("questoes").select("id").eq("id", questaoId).eq("status", "publicada").or(filtroVisivel(simulado.escola_id)).maybeSingle();
  if (!q) throw new Error("Questão não disponível.");
  const { ids: atuais, proxima } = await idsDoSimulado(id);
  if (atuais.includes(questaoId)) return;
  if (atuais.length >= MAX_QUESTOES) throw new Error(`Um simulado pode ter no máximo ${MAX_QUESTOES} questões.`);
  const { error } = await supabase.from("simulado_questoes").insert({ simulado_id: id, questao_id: questaoId, ordem: proxima });
  if (error) throw new Error(error.message);
}

export async function buscarQuestoesBancoPor(ator: AtorEscola, id: string, texto: string, f: FiltrosSorteio) {
  const { simulado } = await exigirSimuladoEditavelPor(ator, id);
  const filtros = limparFiltros(f);
  let c = supabase.from("questoes").select("id, banca, ano, numero, materia, enunciado").eq("status", "publicada").or(filtroVisivel(simulado.escola_id));
  const t = String(texto ?? "").replace(/[%_,()*\\]/g, " ").trim();
  if (t) c = c.ilike("enunciado", `%${t}%`);
  if (filtros.area) c = c.eq("area", filtros.area);
  if (filtros.materia) c = c.eq("materia", filtros.materia);
  if (filtros.banca) c = c.ilike("banca", padraoExato(filtros.banca));
  if (filtros.anoDe) c = c.gte("ano", filtros.anoDe);
  if (filtros.anoAte) c = c.lte("ano", filtros.anoAte);
  const { data } = await c.limit(30);
  return (data ?? []).map((q) => ({ id: q.id, banca: q.banca, ano: q.ano, numero: q.numero, materia: q.materia, trecho: q.enunciado.replace(/[*]/g, "").slice(0, 160) }));
}

/** Reescreve a ordem das questões (0..n-1) na sequência dada. Só antes de alunos começarem. */
export async function ordenarQuestoesPor(ator: AtorEscola, id: string, ordem: string[]): Promise<void> {
  await exigirQuestoesEditaveis(ator, id);
  const { ids: atuais } = await idsDoSimulado(id);
  const erro = validarOrdem(atuais, ordem);
  if (erro) throw new Error(erro);
  if (ordem.length === 0) return;
  const { error } = await supabase.from("simulado_questoes").upsert(ordem.map((questao_id, i) => ({ simulado_id: id, questao_id, ordem: i })), { onConflict: "simulado_id,questao_id" });
  if (error) throw new Error(error.message);
}

export async function publicarSimuladoPor(ator: AtorEscola, id: string): Promise<void> {
  const { simulado } = await exigirSimuladoEditavelPor(ator, id);
  const [{ ids }, { count }] = await Promise.all([idsDoSimulado(id), supabase.from("simulado_turmas").select("simulado_id", { count: "exact", head: true }).eq("simulado_id", id)]);
  const erro = validarPublicacao(simulado, ids.length, count ?? 0);
  if (erro) throw new Error(erro);
  const { error } = await supabase.from("simulados").update({ status: "publicado", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function liberarCorrecaoPor(ator: AtorEscola, id: string): Promise<void> {
  await exigirSimuladoEditavelPor(ator, id);
  const { error } = await supabase.from("simulados").update({ correcao: "na_hora", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Manda o simulado para a Lixeira (restaurável). Devolve o id do item na Lixeira. */
export async function excluirSimuladoPor(ator: AtorEscola, id: string): Promise<string> {
  await exigirSimuladoEditavelPor(ator, id);
  const { data, error } = await supabase.rpc("lixeira_excluir", { p_tipo: "simulado", p_id: id, p_ator: ator.id, p_via: ator.via });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível mandar o simulado para a Lixeira.");
  return data as string;
}
