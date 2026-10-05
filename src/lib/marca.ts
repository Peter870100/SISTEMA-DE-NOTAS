import type { Escola } from "@/lib/types";

const ESCOLA_PADRAO_ID = "00000000-0000-0000-0000-000000000001";

export type MarcaEscola = { nome: string; logo_url: string; slogan: string | null; foto_login_url: string | null; padrao: boolean };

export const MARCA_PADRAO: MarcaEscola = {
  nome: "Colégio Status",
  logo_url: "/logo-status-branca.png",
  slogan: "Cada aprendizado merece atenção.",
  foto_login_url: null,
  padrao: true,
};

export function marcaDaEscola(e: Pick<Escola, "id" | "nome" | "logo_url" | "slogan" | "foto_login_url">): MarcaEscola {
  return { nome: e.nome, logo_url: e.logo_url, slogan: e.slogan, foto_login_url: e.foto_login_url, padrao: e.id === ESCOLA_PADRAO_ID };
}

type Rgb = [number, number, number];
const BRANCO: Rgb = [255, 255, 255];
const PRETO: Rgb = [0, 0, 0];
const TINTA = "#0e1b3d";

export function hexParaRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function paraHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb;
}

function luminancia(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoContraste(a: string, b: string): number {
  const ra = hexParaRgb(a), rb = hexParaRgb(b);
  if (!ra || !rb) return 1;
  const [l1, l2] = [luminancia(ra), luminancia(rb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function textoSobre(hex: string): "#ffffff" | "#0e1b3d" {
  return razaoContraste(hex, "#ffffff") >= razaoContraste(hex, TINTA) ? "#ffffff" : "#0e1b3d";
}

/** Variáveis CSS do tema para as cores da escola. Cor nula ou inválida = mantém o tema padrão. */
export function variaveisDaMarca(corPrincipal: string | null, corDestaque: string | null): Record<string, string> {
  const v: Record<string, string> = {};
  const p = corPrincipal ? hexParaRgb(corPrincipal) : null;
  if (p) {
    v["--color-frame"] = paraHex(p);
    v["--color-frame-deep"] = paraHex(misturar(p, PRETO, 0.25));
    v["--color-frame-line"] = paraHex(misturar(p, BRANCO, 0.15));
    v["--color-frame-muted"] = paraHex(misturar(p, BRANCO, 0.65));
    v["--color-brand"] = paraHex(p);
    v["--color-brand-bright"] = paraHex(misturar(p, BRANCO, 0.25));
  }
  const d = corDestaque ? hexParaRgb(corDestaque) : null;
  if (d) {
    v["--color-gold"] = paraHex(d);
    v["--color-gold-ink"] = textoSobre(paraHex(d));
  }
  return v;
}

export function validarCores(corPrincipal: string | null, corDestaque: string | null): { erro: string | null; alertas: string[] } {
  if (corPrincipal && !hexParaRgb(corPrincipal)) return { erro: "Cor principal inválida (use o formato #RRGGBB).", alertas: [] };
  if (corDestaque && !hexParaRgb(corDestaque)) return { erro: "Cor de destaque inválida (use o formato #RRGGBB).", alertas: [] };
  if (corPrincipal && razaoContraste(corPrincipal, "#ffffff") < 4.5) {
    return { erro: "A cor principal é clara demais: o texto branco do menu e dos botões ficaria ilegível. Escolha um tom mais escuro.", alertas: [] };
  }
  const alertas: string[] = [];
  if (corPrincipal && corDestaque && razaoContraste(corPrincipal, corDestaque) < 3) {
    alertas.push("A cor de destaque quase some sobre a cor principal. Considere um tom mais contrastante.");
  }
  return { erro: null, alertas };
}
