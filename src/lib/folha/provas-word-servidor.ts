import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabase } from "@/lib/supabase/client";
import { padraoExato } from "@/lib/questoes/busca";
import { ESCOLA_PADRAO_ID } from "@/lib/escola-padrao";
import { segredo } from "@/lib/sessao";
import { filtroVisivel, type FiltrosSorteio } from "@/lib/simulados/servidor";
import { emBlocos } from "@/lib/simulados/regras";
import { folhaAluno, folhaGabarito, type DadosFolha, type LetraBolinha } from "./docx";
import { carregarQuestoesFolha } from "./figuras-servidor";
import {
  cenarioIneditas,
  codigoLink,
  escolherQuestoes,
  LIMITE_QUESTOES_PROVA,
  tituloProva,
  type Cenario,
  type TipoProva,
} from "./provas-word";

export type PedidoProva = {
  escolaId: string;
  professorId: string;
  filtros: FiltrosSorteio;
  quantidade: number;
  materiaRotulo: string;
  assuntoNome?: string | null;
};

export type ProvaResumo = {
  id: string;
  titulo: string;
  tipo: TipoProva;
  total: number;
  created_at: string;
  origem: "hermes" | "site";
  escola_id: string;
};

/** Domínio de produção usado nos links mandados pela Hermes. */
export const BASE_LINKS_PROVA = "https://www.statusavalia.com.br";

function conferirQuantidade(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > LIMITE_QUESTOES_PROVA) {
    throw new Error(`A quantidade de questões deve ser de 1 a ${LIMITE_QUESTOES_PROVA}.`);
  }
}

/** Questões que podem entrar numa prova em Word com esses filtros (paginando de 1000 em 1000). */
async function elegiveis(escolaId: string, f: FiltrosSorteio): Promise<string[]> {
  let c = supabase
    .from("questoes")
    .select("id")
    .eq("status", "publicada")
    .eq("anulada", false)
    .not("resposta", "is", null)
    .eq("falta_imagem", false)
    .eq("precisa_revisao", false)
    .or(filtroVisivel(escolaId));
  if (f.area) c = c.eq("area", f.area);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.materias?.length) c = c.in("materia", f.materias);
  if (f.assunto_id) c = c.eq("assunto_id", f.assunto_id);
  if (f.banca) c = c.ilike("banca", padraoExato(f.banca));
  if (f.anoDe) c = c.gte("ano", f.anoDe);
  if (f.anoAte) c = c.lte("ano", f.anoAte);
  const ids: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await c.order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    ids.push(...(data ?? []).map((q) => q.id as string));
    if ((data ?? []).length < 1000) break;
  }
  return ids;
}

/** Questões já postas em provas em Word do professor (inclusive as excluídas do histórico). */
async function usadasPeloProfessor(professorId: string): Promise<Set<string>> {
  const provaIds: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("provas_word").select("id").eq("professor_id", professorId).order("id").range(de, de + 999);
    if (error) throw new Error(error.message);
    provaIds.push(...(data ?? []).map((p) => p.id as string));
    if ((data ?? []).length < 1000) break;
  }
  const usadas = new Set<string>();
  for (const bloco of emBlocos(provaIds, 100)) {
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase
        .from("prova_word_questoes")
        .select("prova_id, questao_id")
        .in("prova_id", bloco)
        .order("prova_id")
        .order("questao_id")
        .range(de, de + 999);
      if (error) throw new Error(error.message);
      for (const q of data ?? []) usadas.add(q.questao_id as string);
      if ((data ?? []).length < 1000) break;
    }
  }
  return usadas;
}

export async function previaProva(p: PedidoProva): Promise<Cenario> {
  conferirQuantidade(p.quantidade);
  const [ids, usadas] = await Promise.all([elegiveis(p.escolaId, p.filtros), usadasPeloProfessor(p.professorId)]);
  return cenarioIneditas(ids, usadas, p.quantidade);
}

export async function gerarProva(
  p: PedidoProva & { tipo: TipoProva; permitirRepetidas: boolean; origem: "hermes" | "site" },
): Promise<{ id: string; titulo: string; total: number; repetidas: number }> {
  conferirQuantidade(p.quantidade);
  const [todas, usadas] = await Promise.all([elegiveis(p.escolaId, p.filtros), usadasPeloProfessor(p.professorId)]);
  const { ids, repetidas } = escolherQuestoes(todas, usadas, p.quantidade, p.permitirRepetidas);
  if (ids.length === 0) throw new Error("Nenhuma questão com esses filtros.");

  const titulo = tituloProva(p.tipo, p.materiaRotulo, p.assuntoNome);
  const { data: prova, error } = await supabase
    .from("provas_word")
    .insert({
      escola_id: p.escolaId,
      professor_id: p.professorId,
      titulo,
      tipo: p.tipo,
      filtros: { ...p.filtros, quantidade: p.quantidade },
      origem: p.origem,
    })
    .select("id")
    .single();
  if (error || !prova) throw new Error(error?.message ?? "Não foi possível gravar a prova.");

  const linhas = ids.map((questao_id, i) => ({ prova_id: prova.id, questao_id, ordem: i + 1 }));
  const { error: errQ } = await supabase.from("prova_word_questoes").insert(linhas);
  if (errQ) {
    await supabase.from("provas_word").delete().eq("id", prova.id);
    throw new Error(errQ.message);
  }
  return { id: prova.id as string, titulo, total: ids.length, repetidas };
}

export async function listarProvas(professorId: string, busca?: string): Promise<ProvaResumo[]> {
  let c = supabase
    .from("provas_word")
    .select("id, titulo, tipo, created_at, origem, escola_id")
    .eq("professor_id", professorId)
    .is("excluida_em", null);
  if (busca?.trim()) c = c.ilike("titulo", `%${padraoExato(busca)}%`);
  const { data, error } = await c.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const provas = data ?? [];

  const totais = new Map<string, number>();
  for (const bloco of emBlocos(provas.map((p) => p.id), 100)) {
    for (let de = 0; ; de += 1000) {
      const { data: qs, error: errQ } = await supabase
        .from("prova_word_questoes")
        .select("prova_id, questao_id")
        .in("prova_id", bloco)
        .order("prova_id")
        .order("questao_id")
        .range(de, de + 999);
      if (errQ) throw new Error(errQ.message);
      for (const q of qs ?? []) totais.set(q.prova_id, (totais.get(q.prova_id) ?? 0) + 1);
      if ((qs ?? []).length < 1000) break;
    }
  }
  return provas.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    total: totais.get(r.id) ?? 0,
    created_at: r.created_at,
    origem: r.origem,
    escola_id: r.escola_id,
  }));
}

export async function lerProva(
  id: string,
): Promise<{ id: string; professor_id: string; escola_id: string; titulo: string; excluida: boolean } | null> {
  const { data, error } = await supabase
    .from("provas_word")
    .select("id, professor_id, escola_id, titulo, excluida_em")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    professor_id: data.professor_id as string,
    escola_id: data.escola_id as string,
    titulo: data.titulo as string,
    excluida: data.excluida_em != null,
  };
}

export async function excluirProva(professorId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("provas_word")
    .update({ excluida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("professor_id", professorId)
    .is("excluida_em", null);
  if (error) throw new Error(error.message);
}

/** Exclui do histórico todas as provas do professor; devolve quantas foram excluídas. */
export async function limparProvas(professorId: string): Promise<number> {
  const { data, error } = await supabase
    .from("provas_word")
    .update({ excluida_em: new Date().toISOString() })
    .eq("professor_id", professorId)
    .is("excluida_em", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "prova"
  );
}

function dataArquivo(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Campo_Grande",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}-${v("month")}-${v("year")}`;
}

async function lerPublico(...caminho: string[]): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), "public", ...caminho));
  } catch {
    console.error(`montarArquivoProva: arquivo public/${caminho.join("/")} não encontrado`);
    return null;
  }
}

async function bolinhasFolha(): Promise<Partial<Record<LetraBolinha, Buffer>>> {
  const letras: LetraBolinha[] = ["A", "B", "C", "D", "E"];
  const arquivos = await Promise.all(letras.map((l) => lerPublico("folha", `alternativa-${l}.png`)));
  const bolinhas: Partial<Record<LetraBolinha, Buffer>> = {};
  letras.forEach((l, i) => {
    const buf = arquivos[i];
    if (buf) bolinhas[l] = buf;
  });
  return bolinhas;
}

export type ProvaFolha = {
  id: string;
  professor_id: string;
  escola_id: string;
  titulo: string;
  created_at: string;
  excluida: boolean;
};

/** Carrega a prova e tudo o que a folha precisa (usado pelo .docx e pela prévia); null se não existir. */
export async function dadosFolhaProva(id: string): Promise<{ prova: ProvaFolha; dados: DadosFolha; nomeBase: string } | null> {
  const { data: prova, error } = await supabase
    .from("provas_word")
    .select("id, professor_id, escola_id, titulo, created_at, excluida_em")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prova) return null;

  const { data: linhas, error: errQ } = await supabase
    .from("prova_word_questoes")
    .select("questao_id, ordem")
    .eq("prova_id", id)
    .order("ordem");
  if (errQ) throw new Error(errQ.message);
  const ids = (linhas ?? []).map((l) => l.questao_id as string);

  const ehStatus = prova.escola_id === ESCOLA_PADRAO_ID;
  const [{ questoes, faltando }, { data: escola }, logo, bolinhas] = await Promise.all([
    carregarQuestoesFolha(ids),
    supabase.from("escolas").select("nome").eq("id", prova.escola_id).maybeSingle(),
    ehStatus ? lerPublico("logo-folha.png") : Promise.resolve(null),
    bolinhasFolha(),
  ]);

  const avisoFinal = faltando.length
    ? faltando.length === 1
      ? "1 questão desta prova não está mais no banco."
      : `${faltando.length} questões desta prova não estão mais no banco.`
    : null;

  const titulo = prova.titulo as string;
  const dados: DadosFolha = {
    titulo,
    escola: (escola?.nome as string | undefined) ?? "",
    logo,
    questoes,
    bolinhas,
    avisoFinal,
  };
  return {
    prova: {
      id: prova.id as string,
      professor_id: prova.professor_id as string,
      escola_id: prova.escola_id as string,
      titulo,
      created_at: prova.created_at as string,
      excluida: prova.excluida_em != null,
    },
    dados,
    nomeBase: `${slug(titulo)}-${dataArquivo(prova.created_at as string)}`,
  };
}

/** Monta na hora o .docx da prova ou do gabarito a partir das questões guardadas. */
export async function montarArquivoProva(id: string, qual: "prova" | "gabarito"): Promise<{ nome: string; buffer: Buffer }> {
  const carregada = await dadosFolhaProva(id);
  if (!carregada) throw new Error("Prova não encontrada.");
  const { dados, nomeBase } = carregada;
  const buffer = qual === "prova" ? await folhaAluno(dados) : await folhaGabarito(dados);
  return { nome: `${nomeBase}${qual === "gabarito" ? "-gabarito" : ""}.docx`, buffer };
}

/** Links sem login (código assinado) para baixar a prova e o gabarito. */
export function linksProva(id: string, base: string): { prova: string; gabarito: string } {
  const c = codigoLink(id, segredo());
  return {
    prova: `${base}/api/provas-word/${id}/prova?c=${c}`,
    gabarito: `${base}/api/provas-word/${id}/gabarito?c=${c}`,
  };
}
