import { z } from "zod";

/** Formato do conteúdo de `materiais_estudo.blocos`: texto puro, nenhum HTML. */
const texto = z.string().trim().min(1);

const esquemaBloco = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("titulo"), texto }).strict(),
  z.object({ tipo: z.literal("paragrafo"), texto }).strict(),
  z.object({ tipo: z.literal("lista"), itens: z.array(texto).min(1) }).strict(),
  z.object({ tipo: z.literal("exemplo"), enunciado: texto, conta: texto.optional(), conclusao: texto.optional() }).strict(),
  z
    .object({ tipo: z.literal("pegadinhas"), itens: z.array(z.object({ titulo: texto, texto }).strict()).min(1) })
    .strict(),
  z
    .object({ tipo: z.literal("trecho"), texto, autor: texto, repare: texto.optional(), imagem_id: z.string().min(1).optional() })
    .strict(),
  z
    .object({
      tipo: z.literal("cartoes"),
      itens: z.array(z.object({ titulo: texto, subtitulo: texto.optional(), texto }).strict()).min(1),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("linha_tempo"),
      titulo: texto,
      legenda: texto.optional(),
      itens: z.array(z.object({ ano: texto, nome: texto, destaque: z.boolean().optional() }).strict()).min(1),
    })
    .strict(),
  z.object({ tipo: z.literal("tabela"), linhas: z.array(z.array(z.string())).min(1) }).strict(),
  z.object({ tipo: z.literal("imagem"), imagem_id: z.string().min(1) }).strict(),
]);

export type Bloco = z.infer<typeof esquemaBloco>;

export const LIMITE_PALAVRAS = 800;

const presente = (t: string | undefined): t is string => !!t;

/** Textos que o aluno lê em um bloco (autor e ids de imagem ficam de fora). */
function textosDoBloco(b: Bloco): string[] {
  switch (b.tipo) {
    case "titulo":
    case "paragrafo":
      return [b.texto];
    case "lista":
      return b.itens;
    case "exemplo":
      return [b.enunciado, b.conta, b.conclusao].filter(presente);
    case "pegadinhas":
      return b.itens.flatMap((i) => [i.titulo, i.texto]);
    case "trecho":
      return [b.texto, b.repare].filter(presente);
    case "cartoes":
      return b.itens.flatMap((i) => [i.titulo, i.subtitulo, i.texto].filter(presente));
    case "linha_tempo":
      return [b.titulo, b.legenda, ...b.itens.flatMap((i) => [i.ano, i.nome])].filter(presente);
    case "tabela":
      return b.linhas.flat();
    case "imagem":
      return [];
  }
}

export function contarPalavras(blocos: Bloco[]): number {
  return blocos
    .flatMap(textosDoBloco)
    .reduce((soma, t) => soma + t.split(/\s+/).filter(Boolean).length, 0);
}

/** Ids de imagem citados (bloco `imagem` e `trecho`), sem repetir. */
export function imagensCitadas(blocos: Bloco[]): string[] {
  const ids = new Set<string>();
  for (const b of blocos) {
    if ((b.tipo === "imagem" || b.tipo === "trecho") && b.imagem_id) ids.add(b.imagem_id);
  }
  return [...ids];
}

export function validarBlocos(
  entrada: unknown,
  imagens: ReadonlySet<string>,
): { ok: true; blocos: Bloco[] } | { ok: false; erro: string } {
  const r = z.array(esquemaBloco).min(1).safeParse(entrada);
  if (!r.success) {
    const p = r.error.issues[0];
    const onde = p.path.length ? ` (em ${p.path.join(".")})` : "";
    return { ok: false, erro: `Conteúdo inválido${onde}: ${p.message}` };
  }
  const blocos = r.data;
  const palavras = contarPalavras(blocos);
  if (palavras > LIMITE_PALAVRAS) {
    return { ok: false, erro: `O texto tem ${palavras} palavras; o limite é ${LIMITE_PALAVRAS}.` };
  }
  const estranha = imagensCitadas(blocos).find((id) => !imagens.has(id));
  if (estranha) return { ok: false, erro: `A imagem "${estranha}" não pertence a este material.` };
  return { ok: true, blocos };
}

/** Troca a chave que quem escreve usou pelo id gravado; chave sem par fica como está. */
export function trocarImagens(blocos: Bloco[], mapa: Record<string, string>): Bloco[] {
  return blocos.map((b) => {
    if ((b.tipo === "imagem" || b.tipo === "trecho") && b.imagem_id && b.imagem_id in mapa) {
      return { ...b, imagem_id: mapa[b.imagem_id] };
    }
    return b;
  });
}

/** O que o aluno vê: some o bloco `imagem` sem imagem aprovada e a foto do `trecho` sem imagem aprovada. */
export function blocosVisiveis(blocos: Bloco[], imagens: ReadonlySet<string>): Bloco[] {
  const saida: Bloco[] = [];
  for (const b of blocos) {
    if (b.tipo === "imagem") {
      if (imagens.has(b.imagem_id)) saida.push(b);
    } else if (b.tipo === "trecho" && b.imagem_id && !imagens.has(b.imagem_id)) {
      const resto = { ...b };
      delete resto.imagem_id;
      saida.push(resto);
    } else {
      saida.push(b);
    }
  }
  return saida;
}
