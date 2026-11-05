/**
 * Leitura do estudo para a tela do aluno e do professor. Única porta de leitura: gabarito e comentário de
 * exercício não respondido nunca saem daqui (as colunas só são lidas para os ids que a conta já respondeu).
 */
import { supabase } from "@/lib/supabase/client";
import { lerPorIds, lerTodas } from "@/lib/desempenho/dados";
import { MATERIAS } from "@/lib/questoes/materias";
import type { Alternativa, ExercicioFixacao, Letra, MaterialEstudo, SituacaoEstudo } from "@/lib/types";
import { blocosVisiveis, contarPalavras, type Bloco } from "./blocos";
import { imagemDisponivel, visivelAoAluno } from "./situacao";
import { exerciciosParaTela, type ExercicioTela, type LinhaExercicio, type ImagemTela } from "./tela";
import { dataUrlDoSvg } from "./svg";
import { minutosDoEstudo } from "./tempo";

export type { ExercicioTela, ImagemTela } from "./tela";

export type EstudoTela = {
  materialId: string;
  assuntoId: string;
  assuntoNome: string;
  materia: string;
  materiaRotulo: string;
  blocos: Bloco[];
  imagens: Record<string, ImagemTela>;
  fonte: "wikipedia" | "ia";
  fonteTitulo: string | null;
  fonteUrl: string | null;
  exercicios: ExercicioTela[];
  links: { id: string; titulo: string; href: string }[];
  minutos: number;
};

export type LeituraEstudo = { estado: "publicado"; estudo: EstudoTela } | { estado: "sem_material" } | { estado: "em_conferencia" };

type ImagemLida = {
  id: string;
  tipo: "desenho" | "foto";
  svg: string | null;
  storage_path: string | null;
  alt: string;
  legenda: string | null;
  credito: string | null;
  licenca: string | null;
  aprovada_em: string | null;
};

function paraTela(i: ImagemLida): ImagemTela {
  const src =
    i.tipo === "desenho"
      ? dataUrlDoSvg(i.svg ?? "")
      : supabase.storage.from("estudos").getPublicUrl(i.storage_path ?? "").data.publicUrl;
  return { id: i.id, src, alt: i.alt, legenda: i.legenda, credito: i.credito, licenca: i.licenca };
}

export async function estudoParaTela(assuntoId: string, contaId: string | null, escolaId: string): Promise<LeituraEstudo> {
  const { data: material, error } = await supabase
    .from("materiais_estudo")
    .select("id, assunto_id, blocos, fonte, fonte_titulo, fonte_url, situacao")
    .eq("assunto_id", assuntoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!material || material.situacao === "rascunho" || material.situacao === "retido") return { estado: "sem_material" };
  if (material.situacao === "em_conferencia") return { estado: "em_conferencia" };

  const { data: assunto, error: eAssunto } = await supabase.from("assuntos").select("id, nome, materia").eq("id", assuntoId).maybeSingle();
  if (eAssunto) throw new Error(eAssunto.message);
  if (!assunto) return { estado: "sem_material" };

  const { data: imgs, error: eImg } = await supabase
    .from("imagens_estudo")
    .select("id, tipo, svg, storage_path, alt, legenda, credito, licenca, aprovada_em")
    .eq("material_id", material.id);
  if (eImg) throw new Error(eImg.message);
  const imagens: Record<string, ImagemTela> = {};
  for (const i of ((imgs ?? []) as ImagemLida[]).filter(imagemDisponivel)) imagens[i.id] = paraTela(i);

  // Sem `resposta_correta` nem `comentario`: estes só entram abaixo, para o que a conta já respondeu.
  const { data: exs, error: eEx } = await supabase
    .from("exercicios_fixacao")
    .select("id, ordem, enunciado, imagem_id, alternativas, situacao")
    .eq("material_id", material.id)
    .order("ordem", { ascending: true });
  if (eEx) throw new Error(eEx.message);
  const visiveis = (exs ?? []).filter((e) => visivelAoAluno(material.situacao, e.situacao));

  const respondidas = new Map<string, { marcada: Letra; acertou: boolean }>();
  if (contaId && visiveis.length > 0) {
    const { data: resp, error: eResp } = await supabase
      .from("respostas_fixacao")
      .select("exercicio_id, marcada, acertou")
      .eq("conta_id", contaId)
      .in("exercicio_id", visiveis.map((e) => e.id));
    if (eResp) throw new Error(eResp.message);
    for (const r of resp ?? []) respondidas.set(r.exercicio_id, { marcada: r.marcada, acertou: r.acertou });
  }
  const gabaritos = new Map<string, { resposta_correta: Letra; comentario: string }>();
  if (respondidas.size > 0) {
    const { data: gab, error: eGab } = await supabase
      .from("exercicios_fixacao")
      .select("id, resposta_correta, comentario")
      .in("id", [...respondidas.keys()]);
    if (eGab) throw new Error(eGab.message);
    for (const g of gab ?? []) gabaritos.set(g.id, { resposta_correta: g.resposta_correta, comentario: g.comentario });
  }

  const exercicios = exerciciosParaTela(visiveis as LinhaExercicio[], respondidas, gabaritos, imagens);

  const { data: mats, error: eMat } = await supabase
    .from("materiais_revisao")
    .select("id, titulo, url")
    .eq("assunto_id", assuntoId)
    .not("url", "is", null)
    .or(`escola_id.is.null,escola_id.eq.${escolaId}`);
  if (eMat) throw new Error(eMat.message);
  const links = (mats ?? []).filter((m) => m.url).map((m) => ({ id: m.id, titulo: m.titulo ?? m.url ?? "", href: m.url ?? "" }));

  const blocos = blocosVisiveis(material.blocos as Bloco[], new Set(Object.keys(imagens)));
  const materia = assunto.materia;
  const rotulo = (MATERIAS as Record<string, { rotulo: string }>)[materia]?.rotulo ?? materia;

  return {
    estado: "publicado",
    estudo: {
      materialId: material.id,
      assuntoId,
      assuntoNome: assunto.nome,
      materia,
      materiaRotulo: rotulo,
      blocos,
      imagens,
      fonte: material.fonte,
      fonteTitulo: material.fonte_titulo,
      fonteUrl: material.fonte_url,
      exercicios,
      links,
      minutos: minutosDoEstudo(contarPalavras(blocos), exercicios.length),
    },
  };
}

/** Assuntos que têm estudo no ar, com o tempo estimado. */
export async function estudosPublicados(assuntoIds: string[]): Promise<Record<string, { minutos: number }>> {
  if (assuntoIds.length === 0) return {};
  const materiais = await lerPorIds<{ id: string; assunto_id: string; blocos: unknown }>(assuntoIds, (bloco, de, ate) =>
    supabase.from("materiais_estudo").select("id, assunto_id, blocos").eq("situacao", "publicado").in("assunto_id", bloco).range(de, ate),
  );
  if (materiais.length === 0) return {};
  const exercicios = await lerPorIds<{ id: string; material_id: string }>(materiais.map((m) => m.id), (bloco, de, ate) =>
    supabase.from("exercicios_fixacao").select("id, material_id").eq("situacao", "publicado").in("material_id", bloco).range(de, ate),
  );
  const porMaterial = new Map<string, number>();
  for (const e of exercicios) porMaterial.set(e.material_id, (porMaterial.get(e.material_id) ?? 0) + 1);
  const saida: Record<string, { minutos: number }> = {};
  for (const m of materiais) {
    saida[m.assunto_id] = { minutos: minutosDoEstudo(contarPalavras(m.blocos as Bloco[]), porMaterial.get(m.id) ?? 0) };
  }
  return saida;
}

// ---------- painel do dono ----------

export type ItemListaEstudo = {
  assuntoId: string;
  nome: string;
  materia: string;
  situacao: SituacaoEstudo | null;
  avisos: number;
  retidos: number;
  fotos: number;
  amostraPendente: boolean;
};

export type ListaEstudos = {
  itens: ItemListaEstudo[];
  /** Quantos assuntos têm cada pendência (só o dono usa). */
  contadores: { avisos: number; retidos: number; fotos: number; amostra: number };
};

/**
 * Assuntos com estudo, por matéria. Professor comum recebe só os publicados e sem pendências; o dono recebe todos,
 * com o que pede atenção. Quem chama decide com `dono` (já conferido na sessão).
 */
export async function listaDeEstudos(dono: boolean): Promise<ListaEstudos> {
  const [assuntos, materiais] = await Promise.all([
    lerTodas<{ id: string; nome: string; materia: string }>((de, ate) =>
      supabase.from("assuntos").select("id, nome, materia").order("id").range(de, ate)),
    lerTodas<{ id: string; assunto_id: string; situacao: SituacaoEstudo; amostra: boolean; lido_em: string | null }>((de, ate) =>
      supabase.from("materiais_estudo").select("id, assunto_id, situacao, amostra, lido_em").order("id").range(de, ate)),
  ]);
  const porAssunto = new Map(assuntos.map((a) => [a.id, a]));
  const soma = {
    avisos: new Map<string, number>(),
    retidos: new Map<string, number>(),
    fotos: new Map<string, number>(),
  };
  if (dono) {
    const [relatos, exercicios, fotos] = await Promise.all([
      lerTodas<{ material_id: string }>((de, ate) =>
        supabase.from("relatos_erro").select("material_id").eq("situacao", "aberto").order("id").range(de, ate)),
      lerTodas<{ material_id: string }>((de, ate) =>
        supabase.from("exercicios_fixacao").select("material_id").eq("situacao", "retido").order("id").range(de, ate)),
      lerTodas<{ material_id: string }>((de, ate) =>
        supabase.from("imagens_estudo").select("material_id").eq("tipo", "foto").is("aprovada_em", null).order("id").range(de, ate)),
    ]);
    const somar = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
    for (const r of relatos) somar(soma.avisos, r.material_id);
    for (const e of exercicios) somar(soma.retidos, e.material_id);
    for (const f of fotos) somar(soma.fotos, f.material_id);
  }

  const itens: ItemListaEstudo[] = [];
  for (const m of materiais) {
    const a = porAssunto.get(m.assunto_id);
    if (!a || (!dono && m.situacao !== "publicado")) continue;
    itens.push({
      assuntoId: a.id,
      nome: a.nome,
      materia: a.materia,
      situacao: m.situacao,
      avisos: soma.avisos.get(m.id) ?? 0,
      retidos: (soma.retidos.get(m.id) ?? 0) + (m.situacao === "retido" ? 1 : 0),
      fotos: soma.fotos.get(m.id) ?? 0,
      amostraPendente: m.amostra && m.situacao === "publicado" && !m.lido_em,
    });
  }
  itens.sort((x, y) => x.materia.localeCompare(y.materia) || x.nome.localeCompare(y.nome, "pt-BR"));
  const conta = (f: (i: ItemListaEstudo) => boolean) => itens.filter(f).length;
  return {
    itens,
    contadores: {
      avisos: conta((i) => i.avisos > 0),
      retidos: conta((i) => i.retidos > 0),
      fotos: conta((i) => i.fotos > 0),
      amostra: conta((i) => i.amostraPendente),
    },
  };
}

export type ImagemDono = ImagemTela & { tipo: "desenho" | "foto"; aprovada: boolean };
export type RelatoAberto = { id: string; exercicioId: string | null; mensagem: string | null; criadoEm: string; quem: "aluno" | "professor" | "desconhecido" };

export type EstudoDono = {
  assuntoNome: string;
  materiaRotulo: string;
  material: MaterialEstudo;
  imagens: ImagemDono[];
  exercicios: ExercicioFixacao[];
  relatos: RelatoAberto[];
};

/**
 * Tudo do estudo, em qualquer situação, com gabarito, motivo, parecer e fotos não aprovadas.
 * Só chamar depois de conferir que a sessão é do dono.
 */
export async function estudoParaDono(assuntoId: string): Promise<EstudoDono | null> {
  const { data: material, error } = await supabase.from("materiais_estudo").select("*").eq("assunto_id", assuntoId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!material) return null;
  const { data: assunto, error: eAssunto } = await supabase.from("assuntos").select("nome, materia").eq("id", assuntoId).maybeSingle();
  if (eAssunto) throw new Error(eAssunto.message);
  if (!assunto) return null;

  const [imgs, exs, relatos] = await Promise.all([
    supabase.from("imagens_estudo").select("id, tipo, svg, storage_path, alt, legenda, credito, licenca, aprovada_em").eq("material_id", material.id).order("criado_em"),
    supabase.from("exercicios_fixacao").select("*").eq("material_id", material.id).order("ordem"),
    supabase.from("relatos_erro").select("id, exercicio_id, mensagem, criado_em, conta_id, professor_id").eq("material_id", material.id).eq("situacao", "aberto").order("criado_em"),
  ]);
  for (const r of [imgs, exs, relatos]) if (r.error) throw new Error(r.error.message);

  return {
    assuntoNome: assunto.nome,
    materiaRotulo: (MATERIAS as Record<string, { rotulo: string }>)[assunto.materia]?.rotulo ?? assunto.materia,
    material: material as MaterialEstudo,
    imagens: ((imgs.data ?? []) as ImagemLida[]).map((i) => ({ ...paraTela(i), tipo: i.tipo, aprovada: imagemDisponivel(i) })),
    exercicios: (exs.data ?? []) as ExercicioFixacao[],
    relatos: (relatos.data ?? []).map((r) => ({
      id: r.id,
      exercicioId: r.exercicio_id,
      mensagem: r.mensagem,
      criadoEm: r.criado_em,
      quem: r.conta_id ? "aluno" : r.professor_id ? "professor" : "desconhecido",
    })),
  };
}
