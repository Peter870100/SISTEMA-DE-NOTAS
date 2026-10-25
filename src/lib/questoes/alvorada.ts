// Importação do dataset Alvorada-Bench (questões de vestibulares, CSV, licença MIT): funções puras.
// O script `scripts/importar-alvorada.ts` lê o arquivo e grava; aqui só se lê o CSV e se monta cada linha.
import type { Area, Database, Letra } from "@/lib/types";
import { areaDaMateria, LETRAS, type Materia } from "./materias";

type Insert = Database["public"]["Tables"]["questoes"]["Insert"];

export type LinhaAlvorada = {
  question_id: string;
  question_number: string;
  subject: string;
  question_statement: string;
  correct_answer: string;
  exam_name: string;
  exam_year: string;
  exam_type: string;
  alternative_a: string;
  alternative_b: string;
  alternative_c: string;
  alternative_d: string;
  alternative_e: string;
};

/** CSV com aspas (RFC 4180): campos entre aspas podem ter vírgula, quebra de linha e "" (aspas escapadas). */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cabecalho, ...resto] = linhas.filter((l) => l.length > 1 || l[0] !== "");
  return resto.map((l) => Object.fromEntries(cabecalho.map((nome, i) => [nome, l[i] ?? ""])));
}

export const BANCAS: Record<string, string> = { enem: "ENEM", fuvest: "FUVEST", unicamp: "UNICAMP", ita: "ITA", ime: "IME" };

const MATERIA_DO_SUBJECT: Record<string, Materia> = {
  "português": "portugues", "inglês": "ingles", "espanhol": "espanhol", "história": "historia", "geografia": "geografia",
  "filosofia": "filosofia", "sociologia": "sociologia", "física": "fisica", "química": "quimica", "biologia": "biologia",
  "matemática": "matematica",
};
/** Rótulos genéricos do dataset (área, não matéria): a matéria fica provisória e a questão vai para revisão. */
const AREA_GENERICA: [RegExp, Area, Materia][] = [
  [/humanas/i, "humanas", "historia"],
  [/natureza/i, "natureza", "biologia"],
  [/linguagens|tecnologias/i, "linguagens", "portugues"],
  [/matem/i, "matematica", "matematica"],
];

const FIGURA = /\b(figuras?|imagens?|gr[aá]ficos?|mapas?|charges?|tabelas?|esquemas?|tirinhas?|ilustra[cç](?:ão|ões)|quadrinhos?|fotos?|fotografias?|desenhos?)\b/i;
// Letras latinas, grego (fórmulas), pontuação, símbolos e setas/matemática; o resto costuma ser erro de leitura (OCR).
const CARACTER_ESTRANHO = /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Common}\p{Script=Inherited}\s]/u;
const ENUNCIADO_CURTO = 60;

export function anoDaProva(l: Pick<LinhaAlvorada, "exam_name" | "exam_year">): number {
  const m = /(19|20)\d\d/.exec(l.exam_name); // o exam_year do ITA 2008–2018 vem errado (2024)
  return Number(m ? m[0] : l.exam_year);
}

/** ITA 2008–2018 vem em provas separadas por matéria, com numeração própria. */
function cadernoDoNome(examName: string): string {
  return /-(fisica|quimica|matematica|portugues)$/.exec(examName)?.[1] ?? "";
}

/** Inglês ou espanhol pelo próprio texto (o rótulo do dataset às vezes troca um pelo outro). */
export function idiomaDoTexto(texto: string): "ingles" | "espanhol" | null {
  const palavras = ` ${texto.toLowerCase().replace(/[^a-záéíóúñü ]/g, " ")} `;
  const conta = (lista: string[]) => lista.reduce((n, p) => n + (palavras.split(` ${p} `).length - 1), 0);
  const es = conta(["el", "los", "las", "del", "una", "es", "por", "con", "para", "como", "pero", "muy", "también"]) + (/[ñ¿¡]/.test(texto) ? 3 : 0);
  const en = conta(["the", "of", "and", "is", "are", "to", "in", "that", "with", "for", "this", "it"]);
  if (es + en < 4) return null;
  return es > en ? "espanhol" : "ingles";
}

const limpar = (v: string) => { const t = (v ?? "").trim(); return t.toLowerCase() === "nan" ? "" : t; };

export type Convertida = { linha: Insert; chave: string; motivos: string[] };

/**
 * Uma linha do CSV vira uma questão do banco geral. Problemas não são corrigidos: viram `motivos`
 * (a questão entra em revisão). `chave` = banca|ano|caderno|número, igual ao índice único do banco.
 */
export function converterLinha(l: LinhaAlvorada): Convertida | null {
  const banca = BANCAS[l.exam_type];
  if (!banca) return null;
  const motivos: string[] = [];
  const enunciado = (l.question_statement ?? "").replace(/\r\n/g, "\n").trim();
  const textos = [l.alternative_a, l.alternative_b, l.alternative_c, l.alternative_d, l.alternative_e].map(limpar);
  const alternativas = LETRAS.map((letra, i) => ({ letra, texto: textos[i] }));
  const cheias = textos.filter(Boolean);
  const resposta = limpar(l.correct_answer).toUpperCase();

  let materia: Materia | undefined = MATERIA_DO_SUBJECT[limpar(l.subject).toLowerCase()];
  let area: Area | undefined = materia ? areaDaMateria(materia) : undefined;
  if (!materia) {
    const generica = AREA_GENERICA.find(([re]) => re.test(l.subject));
    [area, materia] = generica ? [generica[1], generica[2]] : ["linguagens", "portugues"];
    motivos.push(`${MOTIVO_MATERIA_GENERICA} ("${limpar(l.subject)}"): confira a matéria.`);
  }

  let caderno = cadernoDoNome(l.exam_name);
  if (materia === "ingles" || materia === "espanhol") {
    const idioma = idiomaDoTexto(`${enunciado} ${cheias.join(" ")}`);
    if (idioma && idioma !== materia) materia = idioma;
    if (banca === "ENEM") caderno = materia;
  } else if (banca === "ENEM" && /linguagens/i.test(l.subject)) {
    const idioma = idiomaDoTexto(enunciado);
    if (idioma) { materia = idioma; area = "linguagens"; caderno = idioma; }
  }

  if (FIGURA.test(enunciado)) motivos.push("O enunciado cita figura, mapa, gráfico ou tabela, e o dataset não tem imagens.");
  if (cheias.length < 4) motivos.push(`Só ${cheias.length} alternativas preenchidas.`);
  if (new Set(cheias.map((t) => t.toLowerCase())).size < cheias.length) motivos.push("Alternativas repetidas.");
  const letraCerta = LETRAS.includes(resposta as Letra) ? (resposta as Letra) : null;
  if (!letraCerta) motivos.push(`Gabarito fora de A–E ("${resposta}").`);
  else if (!textos[LETRAS.indexOf(letraCerta)]) motivos.push(`O gabarito (${letraCerta}) aponta uma alternativa vazia.`);
  if (enunciado.length < ENUNCIADO_CURTO) motivos.push("Enunciado muito curto ou cortado.");
  if (CARACTER_ESTRANHO.test([enunciado, ...cheias].join(" "))) motivos.push("Caracteres estranhos no texto (possível erro de leitura do dataset).");

  const ano = anoDaProva(l);
  const numero = Number.parseInt(l.question_number, 10);
  const linha: Insert = {
    escopo: "geral",
    escola_id: null,
    banca,
    ano,
    caderno,
    numero: Number.isInteger(numero) ? numero : null,
    area: area ?? areaDaMateria(materia),
    materia,
    assunto_id: null,
    enunciado,
    comando: "",
    alternativas,
    resposta: letraCerta,
    anulada: false,
    status: motivos.length || !letraCerta ? "revisao" : "publicada",
    precisa_revisao: motivos.length > 0,
    motivo_revisao: motivos.length ? motivos.join(" ") : null,
    origem: "dataset",
    fonte_id: `alvorada:${l.question_id}`,
  };
  return { linha, chave: `${banca}|${ano}|${caderno}|${linha.numero ?? ""}`, motivos };
}

export const MOTIVO_MATERIA_GENERICA = "Matéria genérica no dataset";

/**
 * Classificação da IA sobre uma questão do dataset. A matéria do dataset vale, mas a IA pode
 * refiná-la dentro da mesma área (ex.: Português → Literatura, Inglês ↔ Espanhol); se o dataset só
 * tinha a área, vale a matéria da IA. Se a IA aponta outra área, a matéria fica e o assunto não é gravado.
 */
export function decidirClassificacao(
  atual: { materia: string; area: Area; motivo_revisao: string | null },
  ia: { materia: string; area: Area; assunto_id: string | null; assuntoNovo: string | null },
): { materia: string; area: Area; assunto_id: string | null; assuntoNovo: string | null; aviso: string | null } {
  const generica = (atual.motivo_revisao ?? "").includes(MOTIVO_MATERIA_GENERICA);
  if (generica || ia.area === atual.area) return { ...ia, aviso: null };
  return { materia: atual.materia, area: atual.area, assunto_id: null, assuntoNovo: null, aviso: `A IA classificou como ${ia.materia}: confira a matéria.` };
}

/**
 * Números repetidos dentro do próprio dataset (mesma prova e número, textos diferentes): a primeira fica,
 * as seguintes ficam sem número, em revisão, e com fonte_id distinto (`#2`, `#3`…).
 */
export function separarRepetidas(lista: Convertida[]): Convertida[] {
  const vistas = new Map<string, number>();
  const ids = new Map<string, number>();
  return lista.map((c) => {
    let { linha, motivos } = c;
    const vezesId = (ids.get(linha.fonte_id!) ?? 0) + 1;
    ids.set(linha.fonte_id!, vezesId);
    if (vezesId > 1) linha = { ...linha, fonte_id: `${linha.fonte_id}#${vezesId}` };
    const vezes = (vistas.get(c.chave) ?? 0) + 1;
    vistas.set(c.chave, vezes);
    if (vezes === 1 || linha.numero == null) return { ...c, linha };
    motivos = [...motivos, `Número ${linha.numero} repetido no dataset para a mesma prova: confira qual é a questão certa.`];
    return {
      chave: `${c.chave}#${vezes}`,
      motivos,
      linha: { ...linha, numero: null, status: "revisao", precisa_revisao: true, motivo_revisao: motivos.join(" ") },
    };
  });
}
