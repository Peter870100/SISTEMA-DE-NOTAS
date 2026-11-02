// Regras puras da edição da prova em Word (sem banco, sem APIs do Node:
// também é importado por componentes do navegador).

import { cm, FIM_LINHA } from "./medidas";

export type CabecalhoProva = { turma?: string; data?: string; valor?: string; instrucoes?: string };

export const LIMITES_CABECALHO = { titulo: 120, turma: 30, valor: 15, instrucoes: 600 };

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
  // Data fora do formato "AAAA-MM-DD" é descartada (senão a folha sairia com "undefined/…").
  if (r.data !== undefined && !dataValida(r.data)) delete r.data;
  return r;
}

/**
 * Itens da linha extra de identificação ("Turma: …  Data: …  Valor: …"): só os preenchidos,
 * nesta ordem; lista vazia quando nenhum foi preenchido. Usado pelo .docx e pela pré-visualização.
 */
export function itensLinhaCabecalho(cab: CabecalhoProva): { rotulo: string; valor: string }[] {
  const itens: { rotulo: string; valor: string }[] = [];
  if (cab.turma) itens.push({ rotulo: "Turma", valor: cab.turma });
  if (cab.data) itens.push({ rotulo: "Data", valor: dataBR(cab.data) });
  if (cab.valor) itens.push({ rotulo: "Valor", valor: cab.valor });
  return itens;
}

/** Espaço entre os itens da linha extra de identificação (o mesmo no .docx e na tela). */
export const SEPARADOR_LINHA_CABECALHO = "    ";

/** Campo de uma linha de preencher: rótulo, fim do traço (twips; null = sem traço) e texto depois. */
export type CampoIdentificacao = { rotulo: string; ate: number | null; depois?: string };

/**
 * Linhas de identificação da prova, iguais no .docx e na pré-visualização. Sem nada preenchido,
 * são as duas linhas de sempre. Turma e data preenchidas saem das linhas "Aluno(a)" e
 * "Professor(a)" (para não aparecerem duas vezes) e vão, com o valor, para a linha extra.
 */
export function linhasIdentificacao(cab: CabecalhoProva): {
  aluno: CampoIdentificacao[];
  professor: CampoIdentificacao[];
  informada: { rotulo: string; valor: string }[];
} {
  const aluno: CampoIdentificacao[] = cab.turma
    ? [
        { rotulo: "Aluno(a)", ate: FIM_LINHA - cm(2.6) },
        { rotulo: "Nº", ate: FIM_LINHA },
      ]
    : [
        { rotulo: "Aluno(a)", ate: FIM_LINHA - cm(5.2) },
        { rotulo: "Nº", ate: FIM_LINHA - cm(2.6) },
        { rotulo: "Turma", ate: FIM_LINHA },
      ];
  const professor: CampoIdentificacao[] = cab.data
    ? [
        { rotulo: "Professor(a)", ate: FIM_LINHA - cm(3.6) },
        { rotulo: "Nota", ate: FIM_LINHA },
      ]
    : [
        { rotulo: "Professor(a)", ate: FIM_LINHA - cm(7.4) },
        { rotulo: "Data", ate: null, depois: "____/____/______" },
        { rotulo: "Nota", ate: FIM_LINHA },
      ];
  return { aluno, professor, informada: itensLinhaCabecalho(cab) };
}

/** "2026-11-05" vira "05/11/2026". */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Erro de quando a prova mudou desde que o editor montou a lista (o editor recarrega a lista). */
export const PROVA_MUDOU = "A prova mudou; a lista foi atualizada.";

/** A questão no índice é a que o professor clicou? (Protege contra lista desatualizada.) */
export function mesmaQuestao(ids: string[], indice: number, questaoId: string): boolean {
  return Number.isInteger(indice) && indice >= 0 && indice < ids.length && ids[indice] === questaoId;
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
