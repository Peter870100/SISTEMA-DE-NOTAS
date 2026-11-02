import { markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";

export { celulasTabela, comandoRepetido } from "@/lib/questoes/markdown";

const SOBRENOME_INICIAL = /^[A-ZÀ-Ý]{2,}(?:\s[A-ZÀ-Ý]{2,})*,\s/;

/** Parágrafo de fonte/crédito do texto-base ("SOBRENOME, N. ... Acesso em: ..."). */
export function ehCredito(paragrafo: string): boolean {
  const p = paragrafo.trim();
  if (!p) return false;
  if (/dispon[íi]vel em|acesso em/i.test(p) && p.length <= 300) return true;
  return SOBRENOME_INICIAL.test(p);
}

/** Linha que marca o lugar da figura no texto importado ("[Charge]", "[Figura: ...]"); não pega "[...]" nem matriz. */
const MARCA_FIGURA = /^\s*\[\s*[A-Za-zÀ-ÿ][^\]]*\]\s*$/;

/**
 * Para questão com figura: tira do texto os marcadores de figura e o crédito logo abaixo de cada um
 * (a fonte da imagem), para a folha pôr esse crédito embaixo da figura, antes do resto do texto.
 */
export function separarCreditosDeFigura(texto: string): { texto: string; creditos: string[] } {
  const linhas = texto.split(/\r?\n/);
  const saida: string[] = [];
  const creditos: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!MARCA_FIGURA.test(linhas[i])) {
      saida.push(linhas[i]);
      continue;
    }
    let j = i + 1;
    while (j < linhas.length && !linhas[j].trim()) j++;
    if (j < linhas.length && ehCredito(linhas[j])) {
      creditos.push(linhas[j].trim());
      i = j;
    }
  }
  return { texto: saida.join("\n"), creditos };
}

/** Número com dois dígitos: 1 → "01". */
export function numero2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Separa o crédito (último parágrafo não vazio, se for crédito) do corpo do enunciado.
 * O corpo vem em blocos de segmentos (um por linha), sem as linhas vazias do fim.
 */
export function separarCredito(enunciado: string): { corpo: Segmento[][]; credito: string | null } {
  const linhas = (enunciado ?? "").split(/\r?\n/);
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  let credito: string | null = null;
  if (linhas.length && ehCredito(linhas[linhas.length - 1])) {
    credito = linhas.pop()!.trim();
    while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  }
  return { corpo: markdownParaBlocos(linhas.join("\n")), credito };
}

/** Separador "título — assunto" (travessão, meia-risca ou hífen entre espaços). */
export const TRAVESSAO = /\s+[—–-]\s+/;

/** "Tarefa de Matemática — Porcentagem" → "Tarefa de Matemática" (parte antes do travessão). */
export function tituloCurto(titulo: string): string {
  return titulo.split(TRAVESSAO)[0].trim() || titulo;
}
