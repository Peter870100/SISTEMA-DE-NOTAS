// Regras puras da edição da prova em Word (sem banco, sem APIs do Node:
// também é importado por componentes do navegador).

export type CabecalhoProva = { turma?: string; data?: string; valor?: string; instrucoes?: string };

export const LIMITES_CABECALHO = { titulo: 120, turma: 40, valor: 20, instrucoes: 600 };

type EntradaCabecalho = { titulo: string; turma?: string; data?: string; valor?: string; instrucoes?: string };

/** Confere que "AAAA-MM-DD" é uma data real (recusa 2026-02-30). */
function dataValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(iso + "T00:00:00Z");
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() + 1 === Number(m[2]) &&
    d.getUTCDate() === Number(m[3])
  );
}

/** Valida e limpa o cabeçalho editado; omite os campos vazios. */
export function validarCabecalho(
  entrada: EntradaCabecalho,
): { ok: true; titulo: string; cabecalho: CabecalhoProva } | { ok: false; erro: string } {
  const titulo = (entrada.titulo ?? "").trim();
  if (titulo.length < 1 || titulo.length > LIMITES_CABECALHO.titulo) {
    return { ok: false, erro: `O título precisa ter de 1 a ${LIMITES_CABECALHO.titulo} caracteres.` };
  }
  const turma = (entrada.turma ?? "").trim();
  if (turma.length > LIMITES_CABECALHO.turma) {
    return { ok: false, erro: `A turma pode ter até ${LIMITES_CABECALHO.turma} caracteres.` };
  }
  const data = (entrada.data ?? "").trim();
  if (data && !dataValida(data)) return { ok: false, erro: "Data inválida." };
  const valor = (entrada.valor ?? "").trim();
  if (valor.length > LIMITES_CABECALHO.valor) {
    return { ok: false, erro: `O valor pode ter até ${LIMITES_CABECALHO.valor} caracteres.` };
  }
  const instrucoes = (entrada.instrucoes ?? "").trim();
  if (instrucoes.length > LIMITES_CABECALHO.instrucoes) {
    return { ok: false, erro: `As instruções podem ter até ${LIMITES_CABECALHO.instrucoes} caracteres.` };
  }
  const cabecalho: CabecalhoProva = {};
  if (turma) cabecalho.turma = turma;
  if (data) cabecalho.data = data;
  if (valor) cabecalho.valor = valor;
  if (instrucoes) cabecalho.instrucoes = instrucoes;
  return { ok: true, titulo, cabecalho };
}

/** Lê o jsonb do banco ignorando chaves desconhecidas e valores que não são texto. */
export function lerCabecalho(bruto: unknown): CabecalhoProva {
  const r: CabecalhoProva = {};
  if (!bruto || typeof bruto !== "object") return r;
  const o = bruto as Record<string, unknown>;
  for (const k of ["turma", "data", "valor", "instrucoes"] as const) {
    if (typeof o[k] === "string") r[k] = o[k];
  }
  return r;
}

/** "2026-11-05" vira "05/11/2026". */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Move o item de `de` para `para`; null se índice inválido ou sem mudança. */
export function reordenar<T>(lista: T[], de: number, para: number): T[] | null {
  const n = lista.length;
  if (!Number.isInteger(de) || !Number.isInteger(para)) return null;
  if (de < 0 || de >= n || para < 0 || para >= n || de === para) return null;
  const r = [...lista];
  const [item] = r.splice(de, 1);
  r.splice(para, 0, item);
  return r;
}

/** Tira o item do índice; null se inválido ou se sobraria prova vazia. */
export function removerDaOrdem<T>(lista: T[], indice: number): T[] | null {
  if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length || lista.length <= 1) return null;
  return lista.filter((_, i) => i !== indice);
}

/** Sorteia a questão de troca: inédita primeiro; usada só se `aceitarUsadas`. */
export function escolherTroca(
  candidatas: string[],
  naProva: Set<string>,
  usadas: Set<string>,
  aceitarUsadas: boolean,
  aleatorio: () => number = Math.random,
): { id: string; usada: boolean } | { id: null; haUsadas: boolean } {
  const livres = candidatas.filter((id) => !naProva.has(id));
  const sortear = (l: string[]) => l[Math.floor(aleatorio() * l.length)];
  const ineditas = livres.filter((id) => !usadas.has(id));
  if (ineditas.length > 0) return { id: sortear(ineditas), usada: false };
  const jaUsadas = livres.filter((id) => usadas.has(id));
  if (aceitarUsadas && jaUsadas.length > 0) return { id: sortear(jaUsadas), usada: true };
  return { id: null, haUsadas: jaUsadas.length > 0 };
}

/** Texto puro do enunciado, em uma linha, cortado em `max` com "…". */
export function trechoEnunciado(texto: string, max = 90): string {
  const limpo = (texto ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\*\*|__|[_#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length > max ? limpo.slice(0, max - 1) + "…" : limpo;
}
