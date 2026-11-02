// Regras puras da edição da prova em Word (sem banco, sem APIs do Node:
// também é importado por componentes do navegador).

import { cm, FIM_LINHA } from "./medidas";
import { ERRO_VALOR_PROVA, formatarDecimos, lerDecimos } from "./valores";

export type CabecalhoProva = { turma?: string; data?: string; valor?: string; instrucoes?: string; valorPorQuestao?: boolean };

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
  entrada: EntradaCabecalho & { valorPorQuestao?: boolean },
  valorAnterior?: string,
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
  // Valor novo precisa ser número (guardado normalizado, "10,0"); o já salvo antes é mantido como está.
  let valorFinal = valor;
  if (valor && valor !== (valorAnterior ?? "").trim()) {
    const d = lerDecimos(valor);
    if (d === null) return { ok: false, erro: ERRO_VALOR_PROVA };
    valorFinal = formatarDecimos(d);
  }
  const instrucoes = (entrada.instrucoes ?? "").trim();
  if (instrucoes.length > LIMITES_CABECALHO.instrucoes) {
    return { ok: false, erro: `As instruções podem ter até ${LIMITES_CABECALHO.instrucoes} caracteres.` };
  }
  const cabecalho: CabecalhoProva = {};
  if (turma) cabecalho.turma = turma;
  if (data) cabecalho.data = data;
  if (valorFinal) cabecalho.valor = valorFinal;
  if (instrucoes) cabecalho.instrucoes = instrucoes;
  if (entrada.valorPorQuestao !== undefined) cabecalho.valorPorQuestao = entrada.valorPorQuestao;
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
  if (typeof o.valorPorQuestao === "boolean") r.valorPorQuestao = o.valorPorQuestao;
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
  if (cab.valor) {
    const d = lerDecimos(cab.valor);
    itens.push({ rotulo: "Valor", valor: d === null ? cab.valor : formatarDecimos(d) });
  }
  return itens;
}

/** Espaço entre os itens da linha extra de identificação (o mesmo no .docx e na tela). */
export const SEPARADOR_LINHA_CABECALHO = "    ";

/** Tamanho máximo do "Nome ou apelido do professor". */
export const LIMITE_NOME_PROVA = 60;

/** Valida o "Nome ou apelido do professor": trim; em branco vira null (sai o nome normal). */
export function validarNomeProva(texto: string): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const valor = (texto ?? "").trim();
  if (valor.length > LIMITE_NOME_PROVA) {
    return { ok: false, erro: `O nome do professor pode ter até ${LIMITE_NOME_PROVA} caracteres.` };
  }
  return { ok: true, valor: valor || null };
}

/**
 * Nome que sai na linha "Professor(a)": o apelido (`nome_prova`) se houver, senão o nome; com a
 * matéria única da prova, vira "Nome — Matéria". Null quando não há nome nenhum (fica o traço).
 */
export function nomeNaProva(nome: string | null | undefined, nomeProva: string | null | undefined, materiaRotulo?: string | null): string | null {
  const base = (nomeProva ?? "").trim() || (nome ?? "").trim();
  if (!base) return null;
  const materia = (materiaRotulo ?? "").trim();
  return materia ? `${base} — ${materia}` : base;
}

/**
 * Até quantos caracteres o nome cabe na mesma linha de "Data" e "Nota" (Calibri 9 pt, com folga
 * para letras largas). Acima disso, o nome vai numa linha própria, sem tab, que quebra em vez de
 * estourar (como a linha extra de turma/data/valor).
 */
const NOME_NA_LINHA = { comCampoData: 28, semCampoData: 45 };

/** Campo de uma linha de preencher: rótulo, fim do traço (twips; null = sem traço) e texto depois. */
export type CampoIdentificacao = { rotulo: string; ate: number | null; depois?: string };

/**
 * Linhas de identificação da prova, iguais no .docx e na pré-visualização. Sem nada preenchido,
 * são as duas linhas de sempre. Turma e data preenchidas saem das linhas "Aluno(a)" e
 * "Professor(a)" (para não aparecerem duas vezes) e vão, com o valor, para a linha extra.
 * Com o nome do professor, ele entra como texto no lugar do traço; se for longo demais para
 * dividir a linha com "Data" e "Nota", vai sozinho em `nomeProfessor` (linha acima, sem tab).
 */
export function linhasIdentificacao(
  cab: CabecalhoProva,
  nomeProfessor?: string | null,
): {
  aluno: CampoIdentificacao[];
  nomeProfessor: { rotulo: string; valor: string }[];
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
  const data: CampoIdentificacao[] = cab.data ? [] : [{ rotulo: "Data", ate: null, depois: "____/____/______" }];
  const nota: CampoIdentificacao = { rotulo: "Nota", ate: FIM_LINHA };
  const nome = (nomeProfessor ?? "").trim();
  const informada = itensLinhaCabecalho(cab);

  if (!nome) {
    const professor: CampoIdentificacao = { rotulo: "Professor(a)", ate: FIM_LINHA - (cab.data ? cm(3.6) : cm(7.4)) };
    return { aluno, nomeProfessor: [], professor: [professor, ...data, nota], informada };
  }
  const cabe = nome.length <= (cab.data ? NOME_NA_LINHA.semCampoData : NOME_NA_LINHA.comCampoData);
  if (cabe) {
    return { aluno, nomeProfessor: [], professor: [{ rotulo: "Professor(a)", ate: null, depois: nome }, ...data, nota], informada };
  }
  return { aluno, nomeProfessor: [{ rotulo: "Professor(a)", valor: nome }], professor: [...data, nota], informada };
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

/**
 * Arrastar: em que fenda (0..n) o ponteiro está, dados os meios verticais das linhas, em ordem.
 * Fenda f = "antes da linha f"; n = depois da última.
 */
export function fendaArraste(meios: number[], y: number): number {
  return meios.filter((m) => y > m).length;
}

/** Índice final (como em `reordenar`) ao soltar a linha `de` na fenda; igual a `de` = não muda nada. */
export function destinoArraste(de: number, fenda: number): number {
  return fenda > de ? fenda - 1 : fenda;
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
