"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { candidatosSorteio, exigirSimuladoEditavel, filtroVisivel, type FiltrosSorteio } from "@/lib/simulados/servidor";
import { sortear } from "@/lib/simulados/regras";
import { AREAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";

export type DadosSimulado = {
  titulo: string;
  turmas: { turma_nome: string; ano_letivo: string }[];
  duracaoMin: number;
  abreEm: string;
  fechaEm: string;
  correcao: "na_hora" | "apos_prazo";
  embaralhar: boolean;
};

/** Entradas de "use server" não são confiáveis: normaliza os filtros uma única vez. */
function limparFiltros(f: FiltrosSorteio): FiltrosSorteio {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const ano = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const area = texto(f?.area);
  if (area && !Object.prototype.hasOwnProperty.call(AREAS, area)) throw new Error("Área inválida.");
  return {
    area: area as Area | undefined,
    materia: texto(f?.materia),
    assunto_id: texto(f?.assunto_id),
    banca: texto(f?.banca),
    anoDe: ano(f?.anoDe),
    anoAte: ano(f?.anoAte),
  };
}

function limpar(d: DadosSimulado) {
  const titulo = d.titulo.trim();
  if (!titulo) throw new Error("Informe o título.");
  const duracao = Math.round(d.duracaoMin);
  if (!Number.isFinite(duracao) || duracao < 1 || duracao > 600) throw new Error("Duração de 1 a 600 minutos.");
  const abre = Date.parse(d.abreEm), fecha = Date.parse(d.fechaEm);
  if (!Number.isFinite(abre) || !Number.isFinite(fecha) || fecha <= abre) throw new Error("A data de fechamento precisa ser depois da abertura.");
  if (d.correcao !== "na_hora" && d.correcao !== "apos_prazo") throw new Error("Escolha quando sai a correção.");
  return { titulo: titulo.slice(0, 160), duracao_min: duracao, abre_em: new Date(abre).toISOString(), fecha_em: new Date(fecha).toISOString(), correcao: d.correcao, embaralhar: Boolean(d.embaralhar) };
}

/** Só turmas (nome+ano) que o professor pode acessar; mantém as já ligadas. */
async function gravarTurmas(simuladoId: string, escolaId: string, turmas: DadosSimulado["turmas"]) {
  const acessiveis = new Set((await listarTurmasAcessiveis()).map((t) => `${t.nome}|${t.ano_letivo}`));
  const { data: atuais, error: e0 } = await supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", simuladoId);
  if (e0) throw new Error(e0.message);
  const ja = new Set((atuais ?? []).map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const validas = [...new Map(turmas.filter((t) => acessiveis.has(`${t.turma_nome}|${t.ano_letivo}`) || ja.has(`${t.turma_nome}|${t.ano_letivo}`)).map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t])).values()];
  const novas = validas.filter((t) => !ja.has(`${t.turma_nome}|${t.ano_letivo}`));
  const chaves = new Set(validas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const removidas = (atuais ?? []).filter((t) => !chaves.has(`${t.turma_nome}|${t.ano_letivo}`));
  if (novas.length) {
    const { error } = await supabase.from("simulado_turmas").insert(novas.map((t) => ({ simulado_id: simuladoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
    if (error) throw new Error(error.message);
  }
  for (const t of removidas) {
    const { error } = await supabase.from("simulado_turmas").delete().eq("simulado_id", simuladoId).eq("turma_nome", t.turma_nome).eq("ano_letivo", t.ano_letivo);
    if (error) throw new Error(error.message);
  }
}

async function temTentativas(simuladoId: string): Promise<boolean> {
  const { count, error } = await supabase.from("tentativas").select("id", { count: "exact", head: true }).eq("simulado_id", simuladoId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function exigirQuestoesEditaveis(id: string) {
  const r = await exigirSimuladoEditavel(id);
  if (await temTentativas(id)) throw new Error("Alunos já começaram: as questões não podem mais mudar.");
  return r;
}

async function idsDoSimulado(id: string): Promise<{ ids: string[]; proxima: number }> {
  const { data, error } = await supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", id).order("ordem");
  if (error) throw new Error(error.message);
  const linhas = data ?? [];
  return { ids: linhas.map((q) => q.questao_id), proxima: linhas.reduce((m, q) => Math.max(m, q.ordem + 1), 0) };
}

const MAX_QUESTOES = 200;

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** Devolve o erro como texto: em produção o Next esconde a mensagem de erros lançados por actions. */
async function comErro<T>(f: () => Promise<T>, padrao: string): Promise<Resultado<T>> {
  try { return { ok: true, valor: await f() }; }
  catch (e) { return { ok: false, erro: e instanceof Error && e.message ? e.message : padrao }; }
}

export async function criarSimulado(d: DadosSimulado): Promise<Resultado<string>> {
  return comErro(() => gravarNovoSimulado(d), "Não foi possível criar o simulado.");
}

export async function salvarSimulado(id: string, d: DadosSimulado): Promise<Resultado<void>> {
  return comErro(() => gravarSimulado(id, d), "Não foi possível salvar o simulado.");
}

async function gravarNovoSimulado(d: DadosSimulado): Promise<string> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const { data, error } = await supabase.from("simulados").insert({ ...limpar(d), escola_id: professor.escola_id, tipo: "professor", professor_id: professor.id, status: "rascunho" }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar simulado.");
  await gravarTurmas(data.id, professor.escola_id, d.turmas);
  return data.id;
}

async function gravarSimulado(id: string, d: DadosSimulado): Promise<void> {
  const { simulado } = await exigirSimuladoEditavel(id);
  const campos = limpar(d);
  if (await temTentativas(id)) {
    const { data: ligadas, error: eL } = await supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", id);
    if (eL) throw new Error(eL.message);
    const novas = new Set(d.turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
    const mudou = campos.duracao_min !== simulado.duracao_min
      || campos.embaralhar !== Boolean(simulado.embaralhar)
      || Date.parse(campos.abre_em) !== Date.parse(simulado.abre_em ?? "")
      || (ligadas ?? []).some((t) => !novas.has(`${t.turma_nome}|${t.ano_letivo}`));
    if (mudou) throw new Error("Alunos já começaram: só é possível mudar título, correção, fechamento e acrescentar turmas.");
  }
  const { error } = await supabase.from("simulados").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await gravarTurmas(id, simulado.escola_id, d.turmas);
  // Fechamento antecipado vale também para quem já está fazendo a prova.
  if (Date.parse(campos.fecha_em) !== Date.parse(simulado.fecha_em ?? "")) {
    const { error: ePrazo } = await supabase.from("tentativas").update({ prazo_em: campos.fecha_em }).eq("simulado_id", id).eq("status", "em_andamento").gt("prazo_em", campos.fecha_em);
    if (ePrazo) throw new Error(ePrazo.message);
  }
}

export async function sortearQuestoes(id: string, f: FiltrosSorteio & { quantidade: number }) {
  const { simulado } = await exigirQuestoesEditaveis(id);
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
  return { adicionadas: novas.length, pedidas };
}

export async function trocarQuestao(id: string, questaoId: string, f: FiltrosSorteio): Promise<boolean> {
  const { simulado } = await exigirQuestoesEditaveis(id);
  const filtros = limparFiltros(f);
  const { ids: atuais } = await idsDoSimulado(id);
  if (!atuais.includes(questaoId)) throw new Error("Questão não está no simulado.");
  const [nova] = sortear(await candidatosSorteio(simulado.escola_id, filtros, atuais), 1);
  if (!nova) return false;
  const { error } = await supabase.from("simulado_questoes").update({ questao_id: nova }).eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
  return true;
}

export async function removerQuestao(id: string, questaoId: string): Promise<void> {
  await exigirQuestoesEditaveis(id);
  const { error } = await supabase.from("simulado_questoes").delete().eq("simulado_id", id).eq("questao_id", questaoId);
  if (error) throw new Error(error.message);
}

export async function adicionarQuestao(id: string, questaoId: string): Promise<void> {
  const { simulado } = await exigirQuestoesEditaveis(id);
  const { data: q } = await supabase.from("questoes").select("id").eq("id", questaoId).eq("status", "publicada").or(filtroVisivel(simulado.escola_id)).maybeSingle();
  if (!q) throw new Error("Questão não disponível.");
  const { ids: atuais, proxima } = await idsDoSimulado(id);
  if (atuais.includes(questaoId)) return;
  if (atuais.length >= MAX_QUESTOES) throw new Error(`Um simulado pode ter no máximo ${MAX_QUESTOES} questões.`);
  const { error } = await supabase.from("simulado_questoes").insert({ simulado_id: id, questao_id: questaoId, ordem: proxima });
  if (error) throw new Error(error.message);
}

export async function buscarQuestoesBanco(id: string, texto: string, f: FiltrosSorteio) {
  const { simulado } = await exigirSimuladoEditavel(id);
  const filtros = limparFiltros(f);
  let c = supabase.from("questoes").select("id, banca, ano, numero, materia, enunciado").eq("status", "publicada").or(filtroVisivel(simulado.escola_id));
  const t = String(texto ?? "").replace(/[%_,()*\\]/g, " ").trim();
  if (t) c = c.ilike("enunciado", `%${t}%`);
  if (filtros.area) c = c.eq("area", filtros.area);
  if (filtros.materia) c = c.eq("materia", filtros.materia);
  if (filtros.banca) c = c.eq("banca", filtros.banca);
  if (filtros.anoDe) c = c.gte("ano", filtros.anoDe);
  if (filtros.anoAte) c = c.lte("ano", filtros.anoAte);
  const { data } = await c.limit(30);
  return (data ?? []).map((q) => ({ id: q.id, banca: q.banca, ano: q.ano, numero: q.numero, materia: q.materia, trecho: q.enunciado.replace(/[*]/g, "").slice(0, 160) }));
}

export async function publicarSimulado(id: string): Promise<void> {
  const { simulado } = await exigirSimuladoEditavel(id);
  const [{ ids }, { count }] = await Promise.all([idsDoSimulado(id), supabase.from("simulado_turmas").select("simulado_id", { count: "exact", head: true }).eq("simulado_id", id)]);
  if (ids.length === 0) throw new Error("Adicione questões antes de publicar.");
  if ((count ?? 0) === 0) throw new Error("Escolha ao menos uma turma.");
  if (!simulado.abre_em || !simulado.fecha_em) throw new Error("Defina abertura e fechamento.");
  const { error } = await supabase.from("simulados").update({ status: "publicado", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function liberarCorrecao(id: string): Promise<void> {
  await exigirSimuladoEditavel(id);
  const { error } = await supabase.from("simulados").update({ correcao: "na_hora", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
