// Divide blocos de texto mais altos que uma coluna da pré-visualização em pedaços seguidos.
// Puro: sem DOM. Quem mede (o navegador) diz quantos caracteres cabem; aqui se decide onde cortar.
import type { Segmento } from "@/lib/questoes/markdown";
import type { NoConteudo } from "@/lib/questoes/conteudo";
import type { ItemFolha } from "./estrutura";

/** Pedaço de um parágrafo dividido: só o primeiro tem recuo/espaço antes; só o último, espaço depois. */
export type ParteTexto = { primeira: boolean; ultima: boolean };

export type BlocoDividido<F> = { item: ItemFolha<F>; parte?: ParteTexto };

const FIM_DE_FRASE = /[.!?…]+["'”»)\]]*\s+/g;
const ESPACO = /\s+/g;

function fronteiras(texto: string, re: RegExp): number[] {
  const saida: number[] = [];
  for (const m of texto.matchAll(re)) {
    const fim = (m.index ?? 0) + m[0].length;
    if (fim < texto.length) saida.push(fim);
  }
  return saida;
}

/**
 * Onde cortar `texto` para que cada pedaço tenha no máximo `maxCaracteres` (quando der): no fim de
 * frase mais distante que cabe; se nenhuma frase cabe, no fim de palavra; palavra maior que o máximo
 * fica inteira. Devolve as posições de início de cada pedaço depois do primeiro.
 */
export function pontosDeCorte(texto: string, maxCaracteres: number): number[] {
  const max = Math.max(1, Math.floor(maxCaracteres));
  const frases = fronteiras(texto, FIM_DE_FRASE);
  const palavras = fronteiras(texto, ESPACO);
  const ultimaAte = (lista: number[], de: number, ate: number) => {
    let achou: number | undefined;
    for (const b of lista) {
      if (b > de && b <= ate) achou = b;
      else if (b > ate) break;
    }
    return achou;
  };
  const cortes: number[] = [];
  let inicio = 0;
  while (texto.length - inicio > max) {
    const b =
      ultimaAte(frases, inicio, inicio + max) ??
      ultimaAte(palavras, inicio, inicio + max) ??
      palavras.find((p) => p > inicio);
    if (b === undefined) break;
    cortes.push(b);
    inicio = b;
  }
  return cortes;
}

/** Corta uma lista de pedaços de texto (com marcas) nas posições `cortes` do texto concatenado. */
export function cortarLista<T>(
  itens: T[],
  texto: (t: T) => string,
  fatiar: (t: T, de: number, ate: number) => T,
  cortes: number[],
): T[][] {
  const limites = [0, ...cortes, Infinity];
  const saida: T[][] = limites.slice(0, -1).map(() => []);
  let pos = 0;
  for (const t of itens) {
    const tam = texto(t).length;
    for (let k = 0; k < saida.length; k++) {
      const a = limites[k];
      const b = limites[k + 1];
      if (tam === 0) {
        if (pos >= a && pos < b) saida[k].push(t);
        continue;
      }
      const de = Math.max(a, pos);
      const ate = Math.min(b, pos + tam);
      if (de < ate) saida[k].push(de === pos && ate === pos + tam ? t : fatiar(t, de - pos, ate - pos));
    }
    pos += tam;
  }
  return saida.filter((s) => s.length > 0);
}

/** Segmentos de markdown divididos em pedaços de até `maxCaracteres`, mantendo negrito/itálico. */
export function dividirSegmentos(segmentos: Segmento[], maxCaracteres: number): Segmento[][] {
  const texto = segmentos.map((s) => s.texto).join("");
  return cortarLista(segmentos, (s) => s.texto, (s, de, ate) => ({ ...s, texto: s.texto.slice(de, ate) }), pontosDeCorte(texto, maxCaracteres));
}

const textoNo = (n: NoConteudo) => (n.type === "text" && typeof n.text === "string" ? n.text : n.type === "hardBreak" ? "\n" : "");

/** Nós em linha do TipTap divididos em pedaços de até `maxCaracteres`, mantendo as marcas. */
export function dividirNos(nos: NoConteudo[], maxCaracteres: number): NoConteudo[][] {
  const texto = nos.map(textoNo).join("");
  return cortarLista(
    nos,
    textoNo,
    (n, de, ate) => (n.type === "text" ? { ...n, text: (n.text ?? "").slice(de, ate) } : n),
    pontosDeCorte(texto, maxCaracteres),
  );
}

/** Quantos caracteres de texto o item tem (0 = não é texto que se divide). */
export function tamanhoTexto<F>(item: ItemFolha<F>): number {
  switch (item.tipo) {
    case "paragrafo":
    case "comando":
    case "resolucao":
      return item.segmentos.reduce((s, g) => s + g.texto.length, 0);
    case "noConteudo":
      if (item.no.type === "paragraph") return (item.no.content ?? []).map(textoNo).join("").length;
      if (item.no.type === "caixa") return (item.no.content ?? []).reduce((s, p) => s + (p.content ?? []).map(textoNo).join("").length, 0);
      return 0;
    default:
      return 0;
  }
}

function juntarParte(parte: ParteTexto | undefined, i: number, total: number): ParteTexto {
  return { primeira: (parte?.primeira ?? true) && i === 0, ultima: (parte?.ultima ?? true) && i === total - 1 };
}

/**
 * Divide um bloco de texto alto demais. Parágrafo (markdown ou formatado), comando e resolução viram
 * pedaços de até `maxCaracteres` cortados em frases (ou palavras); a caixa vira um bloco por parágrafo
 * dela. `parte` é a do bloco que já era pedaço. Null se o item não se divide (ou daria um pedaço só).
 */
export function dividirItem<F>(item: ItemFolha<F>, maxCaracteres: number, parte?: ParteTexto): BlocoDividido<F>[] | null {
  let itens: ItemFolha<F>[] = [];
  if (item.tipo === "paragrafo" || item.tipo === "comando" || item.tipo === "resolucao") {
    itens = dividirSegmentos(item.segmentos, maxCaracteres).map((segmentos) => ({ ...item, segmentos }));
  } else if (item.tipo === "noConteudo" && item.no.type === "paragraph") {
    itens = dividirNos(item.no.content ?? [], maxCaracteres).map((content) => ({ ...item, no: { ...item.no, content } }));
  } else if (item.tipo === "noConteudo" && item.no.type === "caixa" && !parte) {
    itens = (item.no.content ?? []).map((p) => ({ ...item, no: { ...item.no, content: [p] } }));
  }
  if (itens.length < 2) return null;
  return itens.map((it, i) => ({ item: it, parte: juntarParte(parte, i, itens.length) }));
}
