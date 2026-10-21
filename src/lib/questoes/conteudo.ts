// Documento do enunciado/alternativas (formato TipTap/ProseMirror JSON) e funções puras.
// `limparConteudo` é a fronteira de segurança: o JSON vem do navegador e só sai o que está na lista fechada.

export type AlinhamentoTexto = "left" | "center" | "right" | "justify";
export type MarcaConteudo = { type: "bold" | "italic" | "underline" | "subscript" | "superscript" };
export type NoConteudo = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoConteudo[];
  text?: string;
  marks?: MarcaConteudo[];
};
export type DocConteudo = { type: "doc"; content?: NoConteudo[] };

export const LIMITE_TEXTO_CONTEUDO = 60000;
export const LIMITE_LEGENDA = 300;
const MARCAS = ["bold", "italic", "underline", "subscript", "superscript"] as const;
const ALINHAMENTOS_TEXTO = ["left", "center", "right", "justify"];
const ALINHAMENTOS_FIGURA = ["esquerda", "centro", "direita"];

type Opcoes = { modo: "enunciado" | "alternativa"; imagensValidas?: Set<string> };

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function limparMarcas(v: unknown): MarcaConteudo[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const vistas = new Set<string>();
  const saida: MarcaConteudo[] = [];
  for (const m of v) {
    if (!ehObjeto(m)) continue;
    const t = m.type;
    if (typeof t !== "string" || !(MARCAS as readonly string[]).includes(t) || vistas.has(t)) continue;
    vistas.add(t);
    saida.push({ type: t as MarcaConteudo["type"] });
  }
  return saida.length ? saida : undefined;
}

export function limparConteudo(doc: unknown, opcoes: Opcoes): DocConteudo | null {
  if (!ehObjeto(doc) || doc.type !== "doc" || !Array.isArray(doc.content)) return null;
  const enunciado = opcoes.modo === "enunciado";
  let restante = LIMITE_TEXTO_CONTEUDO;
  let temConteudo = false;

  function inline(lista: unknown): NoConteudo[] {
    if (!Array.isArray(lista)) return [];
    const saida: NoConteudo[] = [];
    for (const n of lista) {
      if (!ehObjeto(n)) continue;
      if (n.type === "hardBreak") {
        saida.push({ type: "hardBreak" });
      } else if (n.type === "text" && typeof n.text === "string") {
        if (restante <= 0) continue;
        const texto = n.text.slice(0, restante);
        if (!texto) continue;
        restante -= texto.length;
        temConteudo = true;
        const marks = limparMarcas(n.marks);
        saida.push(marks ? { type: "text", text: texto, marks } : { type: "text", text: texto });
      }
    }
    return saida;
  }

  function paragrafo(n: Record<string, unknown>): NoConteudo {
    const no: NoConteudo = { type: "paragraph" };
    if (enunciado && ehObjeto(n.attrs)) {
      const attrs: Record<string, unknown> = {};
      const ta = n.attrs.textAlign;
      if (typeof ta === "string" && ALINHAMENTOS_TEXTO.includes(ta)) attrs.textAlign = ta;
      const r = n.attrs.recuo;
      if (typeof r === "number" && Number.isFinite(r)) {
        const recuo = Math.min(3, Math.max(0, Math.floor(r)));
        if (recuo > 0) attrs.recuo = recuo;
      }
      if (Object.keys(attrs).length) no.attrs = attrs;
    }
    const filhos = inline(n.content);
    if (filhos.length) no.content = filhos;
    return no;
  }

  const saida: NoConteudo[] = [];
  for (const n of doc.content) {
    if (!ehObjeto(n)) continue;
    if (n.type === "paragraph") {
      saida.push(paragrafo(n));
    } else if (!enunciado) {
      continue;
    } else if (n.type === "horizontalRule") {
      temConteudo = true;
      saida.push({ type: "horizontalRule" });
    } else if (n.type === "caixa" && Array.isArray(n.content)) {
      const ps = n.content.filter((c): c is Record<string, unknown> => ehObjeto(c) && c.type === "paragraph").map(paragrafo);
      if (ps.length) saida.push({ type: "caixa", content: ps });
    } else if (n.type === "figura" && ehObjeto(n.attrs)) {
      const id = n.attrs.imagemId;
      if (typeof id !== "string" || !id) continue;
      if (opcoes.imagensValidas && !opcoes.imagensValidas.has(id)) continue;
      const al = n.attrs.alinhamento;
      const legenda = typeof n.attrs.legenda === "string" ? n.attrs.legenda.trim().slice(0, LIMITE_LEGENDA) : "";
      temConteudo = true;
      saida.push({
        type: "figura",
        attrs: { imagemId: id, alinhamento: typeof al === "string" && ALINHAMENTOS_FIGURA.includes(al) ? al : "centro", legenda },
      });
    }
  }
  if (!temConteudo) return null;
  return { type: "doc", content: saida };
}

/** Texto puro: parágrafos separados por \n, hardBreak vira \n, figura/linha não geram texto. */
export function textoDoConteudo(doc: DocConteudo | null): string {
  if (!doc?.content) return "";
  const linhas: string[] = [];
  const paragrafo = (p: NoConteudo) =>
    (p.content ?? []).map((n) => (n.type === "hardBreak" ? "\n" : n.type === "text" ? (n.text ?? "") : "")).join("");
  for (const n of doc.content) {
    if (n.type === "paragraph") linhas.push(paragrafo(n));
    else if (n.type === "caixa") for (const p of n.content ?? []) if (p.type === "paragraph") linhas.push(paragrafo(p));
  }
  return linhas.join("\n");
}

/** Ids das figuras na ordem em que aparecem. */
export function imagensDoConteudo(doc: DocConteudo | null): string[] {
  const ids: string[] = [];
  const visitar = (nos?: NoConteudo[]) => {
    for (const n of nos ?? []) {
      if (n.type === "figura" && typeof n.attrs?.imagemId === "string") ids.push(n.attrs.imagemId);
      else if (n.content) visitar(n.content);
    }
  };
  visitar(doc?.content);
  return ids;
}

/** Converte o formato antigo (**negrito**, *itálico*, linhas) em documento. Marcador sem par fica literal. */
export function conteudoDeMarkdown(texto: string): DocConteudo {
  const linhas = (texto ?? "").split(/\r?\n/);
  const content: NoConteudo[] = linhas.map((linha) => {
    const filhos: NoConteudo[] = [];
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let ultimo = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(linha))) {
      if (m.index > ultimo) filhos.push({ type: "text", text: linha.slice(ultimo, m.index) });
      filhos.push({ type: "text", text: m[1] ?? m[2], marks: [{ type: m[1] !== undefined ? "bold" : "italic" }] });
      ultimo = re.lastIndex;
    }
    if (ultimo < linha.length) filhos.push({ type: "text", text: linha.slice(ultimo) });
    return filhos.length ? { type: "paragraph", content: filhos } : { type: "paragraph" };
  });
  return { type: "doc", content };
}

/**
 * Depois de enviar as imagens de uma questão nova: troca os ids provisórios pelos reais (`mapa`)
 * e tira as figuras provisórias que não foram enviadas. Ids que não são provisórios ficam como estão.
 */
export function trocarIdsFiguras(doc: DocConteudo | null, mapa: Map<string, string>, provisorios: Set<string>): DocConteudo | null {
  if (!doc) return null;
  const visitar = (nos?: NoConteudo[]): NoConteudo[] | undefined =>
    nos?.flatMap((n): NoConteudo[] => {
      if (n.type === "figura") {
        const id = n.attrs?.imagemId;
        if (typeof id === "string" && mapa.has(id)) return [{ ...n, attrs: { ...n.attrs, imagemId: mapa.get(id) } }];
        if (typeof id === "string" && provisorios.has(id)) return [];
        return [n];
      }
      return n.content ? [{ ...n, content: visitar(n.content) }] : [n];
    });
  return { ...doc, content: visitar(doc.content) };
}
