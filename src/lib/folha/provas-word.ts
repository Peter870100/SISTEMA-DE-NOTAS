import { createHmac, timingSafeEqual } from "node:crypto";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";

export type TipoProva = "fixacao" | "simulado";

export const LIMITE_QUESTOES_PROVA = 60;

export function tituloProva(tipo: TipoProva, materia: string, assunto?: string | null): string {
  const base = tipo === "fixacao" ? "Atividade de Fixação" : "Simulado";
  const assuntoLimpo = assunto?.trim();
  return `${base} – ${materia}${assuntoLimpo ? ` · ${assuntoLimpo}` : ""}`;
}

export type Cenario = {
  elegiveis: number;
  usadas: number;
  ineditas: number;
  pedidas: number;
  cabeEmIneditas: boolean;
};

/** Quantas das elegíveis o professor já usou em provas anteriores e se as inéditas bastam. */
export function cenarioIneditas(elegiveis: string[], usadas: Set<string>, pedidas: number): Cenario {
  const unicas = [...new Set(elegiveis)];
  const jaUsadas = unicas.filter((id) => usadas.has(id)).length;
  const ineditas = unicas.length - jaUsadas;
  return {
    elegiveis: unicas.length,
    usadas: jaUsadas,
    ineditas,
    pedidas,
    cabeEmIneditas: ineditas >= pedidas,
  };
}

function embaralhar<T>(lista: T[], aleatorio: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Sorteia as inéditas primeiro; só completa com já usadas se `permitirRepetidas`. */
export function escolherQuestoes(
  elegiveis: string[],
  usadas: Set<string>,
  pedidas: number,
  permitirRepetidas: boolean,
  aleatorio: () => number = Math.random,
): { ids: string[]; repetidas: number } {
  const unicas = [...new Set(elegiveis)];
  const ineditas = embaralhar(
    unicas.filter((id) => !usadas.has(id)),
    aleatorio,
  );
  const jaUsadas = permitirRepetidas
    ? embaralhar(
        unicas.filter((id) => usadas.has(id)),
        aleatorio,
      )
    : [];
  const ids = [...ineditas, ...jaUsadas].slice(0, Math.max(0, pedidas));
  const repetidas = ids.filter((id) => usadas.has(id)).length;
  return { ids, repetidas };
}

function hmacProva(provaId: string, chave: string): string {
  return createHmac("sha256", chave).update(`prova-word:${provaId}`).digest("hex").slice(0, 32);
}

/** Código do link sem login (`?c=`) de uma prova. */
export function codigoLink(provaId: string, chave: string): string {
  return hmacProva(provaId, chave);
}

export function verificarCodigoLink(
  provaId: string,
  codigo: string | null | undefined,
  chave: string,
): boolean {
  if (!codigo) return false;
  const recebido = Buffer.from(codigo);
  const esperado = Buffer.from(hmacProva(provaId, chave));
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Rótulo da matéria para o título: a matéria; sem ela, a área; senão "Questões". Pura. */
export function materiaRotulo(f: { materia?: string; area?: Area }): string {
  if (f.materia) return (MATERIAS as Record<string, { rotulo: string }>)[f.materia]?.rotulo ?? f.materia;
  if (f.area) return AREAS[f.area];
  return "Questões";
}

/** Rótulo da matéria quando a prova é de uma matéria só (`filtros.materia` conhecida); senão null. Pura. */
export function materiaUnicaRotulo(filtros: unknown): string | null {
  if (!filtros || typeof filtros !== "object") return null;
  const materia = (filtros as { materia?: unknown }).materia;
  if (typeof materia !== "string" || !Object.hasOwn(MATERIAS, materia)) return null;
  return (MATERIAS as Record<string, { rotulo: string }>)[materia].rotulo;
}

/** "Biologia · Genética (UFMS)": o que foi pedido, para a prévia. Pura. */
export function rotuloPedido(materia: string, assunto: string | null, banca?: string): string {
  const b = banca?.trim();
  return `${materia}${assunto ? ` · ${assunto}` : ""}${b ? ` (${b.toUpperCase()})` : ""}`;
}

/** Texto da prévia (o mesmo na Hermes e no site). Pura. */
export function textoPrevia(rotulo: string, c: Cenario): string {
  if (c.elegiveis === 0) return `${rotulo}: nenhuma questão no banco com esses filtros (com figuras e publicadas). Tente outros filtros.`;
  const base = `${rotulo}: ${c.elegiveis} ${c.elegiveis === 1 ? "questão" : "questões"} no banco; você já usou ${c.usadas}; ${c.ineditas} ${c.ineditas === 1 ? "inédita" : "inéditas"}. Pedidas: ${c.pedidas}`;
  if (c.cabeEmIneditas) return `${base} — cabem só em inéditas.`;
  const partes = [`${base} — só há ${c.ineditas} ${c.ineditas === 1 ? "inédita" : "inéditas"} para ${c.pedidas} pedidas.`];
  if (c.elegiveis < c.pedidas) partes.push(`Mesmo completando com já usadas, a prova terá no máximo ${c.elegiveis} ${c.elegiveis === 1 ? "questão" : "questões"}.`);
  return partes.join(" ");
}
