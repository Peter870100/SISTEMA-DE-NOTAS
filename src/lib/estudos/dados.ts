/**
 * Leitura do estudo para a tela do aluno e do professor. Única porta de leitura: gabarito e comentário de
 * exercício não respondido nunca saem daqui (as colunas só são lidas para os ids que a conta já respondeu).
 */
import { supabase } from "@/lib/supabase/client";
import { lerPorIds } from "@/lib/desempenho/dados";
import { MATERIAS } from "@/lib/questoes/materias";
import type { Alternativa, Letra } from "@/lib/types";
import { blocosVisiveis, contarPalavras, type Bloco } from "./blocos";
import { visivelAoAluno } from "./situacao";
import { dataUrlDoSvg } from "./svg";
import { minutosDoEstudo } from "./tempo";

export type ImagemTela = { id: string; src: string; alt: string; legenda: string | null; credito: string | null; licenca: string | null };

export type ExercicioTela = {
  id: string;
  ordem: number;
  enunciado: string;
  alternativas: { letra: Letra; texto: string }[];
  imagem: ImagemTela | null;
  resposta: { marcada: Letra; acertou: boolean; certa: Letra; comentario: string } | null;
};

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
    .select("id, tipo, svg, storage_path, alt, legenda, credito, licenca")
    .eq("material_id", material.id)
    .not("aprovada_em", "is", null);
  if (eImg) throw new Error(eImg.message);
  const imagens: Record<string, ImagemTela> = {};
  for (const i of (imgs ?? []) as ImagemLida[]) imagens[i.id] = paraTela(i);

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

  const exercicios: ExercicioTela[] = visiveis.map((e) => {
    const feita = respondidas.get(e.id);
    const gab = gabaritos.get(e.id);
    return {
      id: e.id,
      ordem: e.ordem,
      enunciado: e.enunciado,
      alternativas: (e.alternativas as Alternativa[]).map((a) => ({ letra: a.letra, texto: a.texto })),
      imagem: e.imagem_id ? imagens[e.imagem_id] ?? null : null,
      resposta: feita && gab ? { marcada: feita.marcada, acertou: feita.acertou, certa: gab.resposta_correta, comentario: gab.comentario } : null,
    };
  });

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
