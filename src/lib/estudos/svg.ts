export const LIMITE_SVG = 30 * 1024;

const ELEMENTOS = new Set([
  "svg", "g", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse",
  "text", "tspan", "title", "defs", "marker", "linearGradient", "stop",
]);

const XMLNS_SVG = "http://www.w3.org/2000/svg";

// Tag: nome + atributos (aspas podem conter ">") + "/" opcional. Um só leitor, para validar e para achar a raiz.
const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/y;

// No <img> o SVG é XML estrito: só estas entidades (e as numéricas) existem.
const ENTIDADE_INVALIDA = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);)/;

type Resultado = { ok: true } | { ok: false; erro: string };

/** Lê os atributos de uma tag (sem o nome); devolve null se estiver malformada. */
function lerAtributos(texto: string): [string, string][] | null {
  const atributos: [string, string][] = [];
  const re = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  let pos = 0;
  while (pos < texto.length) {
    if (/^\s*$/.test(texto.slice(pos))) return atributos;
    re.lastIndex = pos;
    const m = re.exec(texto);
    if (!m) return null;
    atributos.push([m[1], m[2] ?? m[3] ?? ""]);
    pos = re.lastIndex;
  }
  return atributos;
}

function erroDoAtributo(nome: string, valor: string, raiz: boolean): string | null {
  const n = nome.toLowerCase();
  if (n.startsWith("on")) return `atributo ${nome} não é permitido`;
  if (n === "href" || n === "xlink:href" || n === "src") return `atributo ${nome} não é permitido`;
  if (n.startsWith("xmlns")) {
    if (n === "xmlns" && raiz && valor === XMLNS_SVG) return null;
    return `atributo ${nome} não é permitido`;
  }
  if (n === "style" && /url\s*\(/i.test(valor)) return "style com url() não é permitido";
  for (const m of valor.matchAll(/url\s*\(\s*([^)]*)/gi)) {
    if (!m[1].trim().startsWith("#")) return "url() só pode apontar para #id";
  }
  return null;
}

export function validarSvg(svg: string): Resultado {
  if (Buffer.byteLength(svg, "utf8") > LIMITE_SVG) return { ok: false, erro: "desenho acima de 30 KB" };
  const texto = svg.trim();
  const abertas: string[] = [];
  let raizVista = false;
  let pos = 0;
  if (ENTIDADE_INVALIDA.test(texto)) return { ok: false, erro: "& solto ou entidade não permitida (use &amp;)" };
  const tag = new RegExp(TAG.source, "y");
  while (pos < texto.length) {
    const prox = texto.indexOf("<", pos);
    if (prox === -1) break;
    if (/[^\s]/.test(texto.slice(pos, prox)) && abertas.length === 0) {
      return { ok: false, erro: "texto fora do desenho" };
    }
    tag.lastIndex = prox;
    const m = tag.exec(texto);
    if (!m) return { ok: false, erro: "tag malformada ou não permitida" };
    const [, fecha, nome, resto, auto] = m;
    if (!ELEMENTOS.has(nome)) return { ok: false, erro: `elemento ${nome} não é permitido` };
    if (fecha) {
      if (resto.trim() || auto || abertas.pop() !== nome) return { ok: false, erro: "tags mal aninhadas" };
    } else {
      if (!raizVista && nome !== "svg") return { ok: false, erro: "o desenho deve começar com <svg>" };
      if (raizVista && abertas.length === 0) return { ok: false, erro: "mais de um elemento na raiz" };
      const atributos = lerAtributos(resto);
      if (!atributos) return { ok: false, erro: "atributos malformados" };
      if (new Set(atributos.map(([a]) => a)).size !== atributos.length) return { ok: false, erro: "atributo repetido" };
      for (const [a, v] of atributos) {
        const e = erroDoAtributo(a, v, !raizVista);
        if (e) return { ok: false, erro: e };
      }
      raizVista = true;
      if (!auto) abertas.push(nome);
    }
    pos = tag.lastIndex;
  }
  if (!raizVista) return { ok: false, erro: "não é um desenho SVG" };
  if (abertas.length) return { ok: false, erro: "tag não fechada" };
  if (/[^\s]/.test(texto.slice(pos)) && !texto.slice(pos).startsWith("<")) {
    return { ok: false, erro: "texto fora do desenho" };
  }
  return { ok: true };
}

/** Data URL para <img>; o navegador só desenha o SVG se a raiz declarar o xmlns. */
export function dataUrlDoSvg(svg: string): string {
  let s = svg.trim();
  const tag = new RegExp(TAG.source, "y");
  tag.lastIndex = s.indexOf("<");
  const raiz = tag.exec(s);
  const atributos = raiz && !raiz[1] && raiz[2] === "svg" ? lerAtributos(raiz[3]) : null;
  if (!atributos?.some(([nome]) => nome === "xmlns")) s = s.replace(/^<svg/, `<svg xmlns="${XMLNS_SVG}"`);
  return `data:image/svg+xml;base64,${Buffer.from(s, "utf8").toString("base64")}`;
}
