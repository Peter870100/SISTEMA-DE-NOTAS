"use server";

import { supabase } from "@/lib/supabase/client";
import { exigirNaoAluno, getProfessorAtual } from "@/lib/auth";
import { exigirCursoEditavel } from "@/lib/aulas/acesso";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { extrairIdYoutube } from "@/lib/aulas/youtube";
import type { RegraGabarito } from "@/lib/types";

export type DadosCurso = {
  titulo: string;
  disciplina: string;
  descricao: string;
  turmas: { turma_nome: string; ano_letivo: string }[];
};

function limparCurso(dados: DadosCurso) {
  const titulo = dados.titulo.trim();
  const disciplina = dados.disciplina.trim();
  if (!titulo || !disciplina) throw new Error("Informe o título e a disciplina.");
  return { titulo, disciplina, descricao: dados.descricao.trim() || null };
}

async function gravarTurmas(cursoId: string, escolaId: string, turmas: DadosCurso["turmas"]) {
  // Só aceita turmas que quem salva pode acessar, mais as que o curso já tem (ex.: vinculadas pelo admin).
  const [acessiveis, { data: atuais, error: erroAtuais }] = await Promise.all([
    listarTurmasAcessiveis(),
    supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", cursoId),
  ]);
  if (erroAtuais) throw new Error(erroAtuais.message);
  const permitidas = new Set([
    ...acessiveis.map((t) => `${t.nome}|${t.ano_letivo}`),
    ...(atuais ?? []).map((t) => `${t.turma_nome}|${t.ano_letivo}`),
  ]);
  const aceitas = turmas.filter((t) => permitidas.has(`${t.turma_nome}|${t.ano_letivo}`));
  await supabase.from("curso_turmas").delete().eq("curso_id", cursoId);
  const unicas = [...new Map(aceitas.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t])).values()];
  if (unicas.length === 0) return;
  const { error } = await supabase
    .from("curso_turmas")
    .insert(unicas.map((t) => ({ curso_id: cursoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
  if (error) throw new Error(error.message);
}

export async function criarCurso(dados: DadosCurso): Promise<string> {
  await exigirNaoAluno();
  const professor = await getProfessorAtual();
  if (!professor) throw new Error("Faça login novamente.");
  const limpo = limparCurso(dados);
  const { data, error } = await supabase
    .from("cursos")
    .insert({ ...limpo, escola_id: professor.escola_id, professor_id: professor.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar curso.");
  await gravarTurmas(data.id, professor.escola_id, dados.turmas);
  return data.id;
}

export async function atualizarCurso(cursoId: string, dados: DadosCurso): Promise<void> {
  const { curso } = await exigirCursoEditavel(cursoId);
  const { error } = await supabase
    .from("cursos")
    .update({ ...limparCurso(dados), updated_at: new Date().toISOString() })
    .eq("id", cursoId);
  if (error) throw new Error(error.message);
  await gravarTurmas(cursoId, curso.escola_id, dados.turmas);
}

async function moduloEditavel(moduloId: string) {
  const { data: modulo } = await supabase.from("modulos").select("*").eq("id", moduloId).maybeSingle();
  if (!modulo) throw new Error("Módulo não encontrado.");
  await exigirCursoEditavel(modulo.curso_id);
  return modulo;
}

async function aulaEditavel(aulaId: string) {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  const { curso } = await exigirCursoEditavel(aula.curso_id);
  return { aula, curso };
}

export async function criarModulo(cursoId: string, titulo: string): Promise<void> {
  await exigirCursoEditavel(cursoId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o nome do módulo.");
  const { count } = await supabase.from("modulos").select("id", { count: "exact", head: true }).eq("curso_id", cursoId);
  const { error } = await supabase.from("modulos").insert({ curso_id: cursoId, titulo: limpo, ordem: count ?? 0 });
  if (error) throw new Error(error.message);
}

export async function renomearModulo(moduloId: string, titulo: string): Promise<void> {
  await moduloEditavel(moduloId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o nome do módulo.");
  const { error } = await supabase.from("modulos").update({ titulo: limpo }).eq("id", moduloId);
  if (error) throw new Error(error.message);
}

async function apagarPdfsDasAulas(aulaIds: string[]) {
  if (aulaIds.length === 0) return;
  const { data } = await supabase.from("aula_arquivos").select("storage_path").in("aula_id", aulaIds);
  const caminhos = (data ?? []).map((a) => a.storage_path);
  if (caminhos.length) await supabase.storage.from("materiais").remove(caminhos);
}

export async function excluirModulo(moduloId: string): Promise<void> {
  await moduloEditavel(moduloId);
  const { data: aulas } = await supabase.from("aulas").select("id").eq("modulo_id", moduloId);
  await apagarPdfsDasAulas((aulas ?? []).map((a) => a.id));
  const { error } = await supabase.from("modulos").delete().eq("id", moduloId);
  if (error) throw new Error(error.message);
}

/** Devolve os ids na nova ordem após trocar com o vizinho (acima: -1, abaixo: 1), ou null se não der. */
function reordenar(lista: { id: string }[], id: string, direcao: -1 | 1): string[] | null {
  const ids = lista.map((l) => l.id);
  const i = ids.indexOf(id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

export async function moverModulo(moduloId: string, direcao: -1 | 1): Promise<void> {
  const modulo = await moduloEditavel(moduloId);
  const { data } = await supabase.from("modulos").select("id").eq("curso_id", modulo.curso_id).order("ordem");
  const ids = reordenar(data ?? [], moduloId, direcao);
  if (!ids) return;
  for (let k = 0; k < ids.length; k++) {
    const { error } = await supabase.from("modulos").update({ ordem: k }).eq("id", ids[k]);
    if (error) throw new Error(error.message);
  }
}

export async function criarAula(moduloId: string, titulo: string): Promise<string> {
  const modulo = await moduloEditavel(moduloId);
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Informe o título da aula.");
  const { count } = await supabase.from("aulas").select("id", { count: "exact", head: true }).eq("modulo_id", moduloId);
  const { data, error } = await supabase
    .from("aulas")
    .insert({ modulo_id: moduloId, curso_id: modulo.curso_id, titulo: limpo, ordem: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar aula.");
  return data.id;
}

export type DadosAula = {
  titulo: string;
  texto: string;
  linkVideo: string;
  duracaoSeg: number | null;
  gabarito_liberacao: RegraGabarito;
  gabarito_libera_em: string | null;
};

export async function salvarAula(aulaId: string, dados: DadosAula): Promise<void> {
  const { aula: existente } = await aulaEditavel(aulaId);
  const titulo = dados.titulo.trim();
  if (!titulo) throw new Error("Informe o título da aula.");
  let video_id: string | null = null;
  if (dados.linkVideo.trim()) {
    video_id = extrairIdYoutube(dados.linkVideo);
    if (!video_id) throw new Error("Link do YouTube não reconhecido.");
  }
  let duracao_seg: number | null = null;
  if (video_id) {
    const d = dados.duracaoSeg;
    if (typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 21600) duracao_seg = d;
    else if (existente.video_id === video_id) duracao_seg = existente.duracao_seg;
  }
  if (!["junto", "apos_concluir", "data"].includes(dados.gabarito_liberacao)) throw new Error("Regra do gabarito inválida.");
  if (dados.gabarito_liberacao === "data" && (!dados.gabarito_libera_em || Number.isNaN(Date.parse(dados.gabarito_libera_em)))) {
    throw new Error("Informe a data de liberação do gabarito.");
  }
  const { error } = await supabase
    .from("aulas")
    .update({
      titulo,
      texto: dados.texto.trim() || null,
      video_provedor: video_id ? "youtube" : null,
      video_id,
      duracao_seg,
      gabarito_liberacao: dados.gabarito_liberacao,
      gabarito_libera_em: dados.gabarito_liberacao === "data" ? new Date(dados.gabarito_libera_em!).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function definirPublicacao(aulaId: string, publicada: boolean): Promise<void> {
  const { aula } = await aulaEditavel(aulaId);
  if (publicada && aula.video_id && aula.duracao_seg == null) {
    throw new Error("Espere a prévia do vídeo carregar para registrar a duração.");
  }
  const { error } = await supabase
    .from("aulas")
    .update({ publicada, publicada_em: publicada ? aula.publicada_em ?? new Date().toISOString() : aula.publicada_em })
    .eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function excluirAula(aulaId: string): Promise<void> {
  await aulaEditavel(aulaId);
  await apagarPdfsDasAulas([aulaId]);
  const { error } = await supabase.from("aulas").delete().eq("id", aulaId);
  if (error) throw new Error(error.message);
}

export async function moverAula(aulaId: string, direcao: -1 | 1): Promise<void> {
  const { aula } = await aulaEditavel(aulaId);
  const { data } = await supabase.from("aulas").select("id").eq("modulo_id", aula.modulo_id).order("ordem");
  const ids = reordenar(data ?? [], aulaId, direcao);
  if (!ids) return;
  for (let k = 0; k < ids.length; k++) {
    const { error } = await supabase.from("aulas").update({ ordem: k }).eq("id", ids[k]);
    if (error) throw new Error(error.message);
  }
}

export async function contarProgressos(alvo: { moduloId?: string; aulaId?: string }): Promise<number> {
  let aulaIds: string[] = [];
  if (alvo.aulaId) {
    await aulaEditavel(alvo.aulaId);
    aulaIds = [alvo.aulaId];
  } else if (alvo.moduloId) {
    await moduloEditavel(alvo.moduloId);
    const { data } = await supabase.from("aulas").select("id").eq("modulo_id", alvo.moduloId);
    aulaIds = (data ?? []).map((a) => a.id);
  }
  if (aulaIds.length === 0) return 0;
  const { data } = await supabase.from("aula_progresso").select("conta_id").in("aula_id", aulaIds);
  return new Set((data ?? []).map((p) => p.conta_id)).size;
}
