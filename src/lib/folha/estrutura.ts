// O que vai na folha (prova e gabarito), em ordem, sem desenhar nada: o .docx (`./docx`) e a
// pré-visualização no navegador desenham a mesma lista. Puro: sem a biblioteca `docx` nem `Buffer`.
import { enunciadoNaTela, markdownParaBlocos, type Segmento } from "@/lib/questoes/markdown";
import { imagensDoConteudo, type DocConteudo, type NoConteudo } from "@/lib/questoes/conteudo";
import { celulasTabela, comandoRepetido, separarCredito } from "./texto";

export type AlvoFigura = "enunciado" | "A" | "B" | "C" | "D" | "E";

/** O que a estrutura precisa saber de uma figura; quem desenha acrescenta a imagem e o tamanho. */
export type FiguraRef = { id: string; alvo: AlvoFigura; alinhamento: "esquerda" | "centro" | "direita" };

export type QuestaoBase<F extends FiguraRef> = {
  id: string;
  enunciado: string;
  /** Enunciado formatado (TipTap); quando há, substitui o `enunciado` em markdown. */
  conteudo?: DocConteudo | null;
  comando: string;
  alternativas: { letra: string; texto: string; conteudo?: DocConteudo | null }[];
  resposta: string | null;
  resolucao: string | null;
  materia: string;
  figuras?: F[];
  /** Ex.: "UFMS 2024". */
  origem?: string | null;
};

export type ItemFolha<F> =
  /** Faixa da matéria antes de cada bloco de questões seguidas da mesma matéria. */
  | { tipo: "faixa"; materia: string; de: number; ate: number; primeira: boolean }
  | { tipo: "titulo"; numero: number; primeiraDoBloco: boolean }
  /** Parágrafo do enunciado em markdown; `indice` conta só os parágrafos (o 0 ganha respiro). */
  | { tipo: "paragrafo"; segmentos: Segmento[]; indice: number }
  | { tipo: "tabela"; linhas: string[][] }
  /** Parágrafo, linha ou caixa do enunciado formatado (a caixa já vem só com parágrafos com texto). */
  | { tipo: "noConteudo"; no: NoConteudo; primeiro: boolean }
  /** `figura` indefinida = não encontrada (vira aviso); sem `alinhamento`, vale o da figura. */
  | { tipo: "figura"; figura: F | undefined; alinhamento?: string; legenda?: string; naAlternativa: boolean }
  | { tipo: "credito"; credito: string | null; origem: string | null }
  /** `comTexto`: o enunciado teve algum bloco antes (muda o respiro do 1º parágrafo do comando). */
  | { tipo: "comando"; segmentos: Segmento[]; indice: number; comTexto: boolean }
  | { tipo: "alternativa"; letra: string; texto: string; conteudo?: DocConteudo | null }
  | { tipo: "resolucao"; segmentos: Segmento[]; indice: number }
  | { tipo: "resposta"; letra: string | null }
  | { tipo: "aviso"; texto: string };

type PorQuestao<F extends FiguraRef> = (q: QuestaoBase<F>, n: number, primeiraDoBloco: boolean) => ItemFolha<F>[];

function blocosNaoVazios(blocos: Segmento[][]): Segmento[][] {
  return blocos.filter((b) => b.some((s) => s.texto.trim()));
}

/** O nó tem algum texto que não seja só espaço. */
export function temTexto(no: NoConteudo): boolean {
  return (no.content ?? []).some((n) => n.type === "text" && !!n.text?.trim());
}

/** Põe a faixa da matéria antes de cada bloco de questões seguidas da mesma matéria; aviso no fim. */
function comFaixas<F extends FiguraRef>(
  questoes: QuestaoBase<F>[],
  porQuestao: PorQuestao<F>,
  avisoFinal: string | null | undefined,
): ItemFolha<F>[] {
  const saida: ItemFolha<F>[] = [];
  let i = 0;
  while (i < questoes.length) {
    let fim = i;
    while (fim + 1 < questoes.length && questoes[fim + 1].materia === questoes[i].materia) fim++;
    saida.push({ tipo: "faixa", materia: questoes[i].materia, de: i + 1, ate: fim + 1, primeira: i === 0 });
    for (let k = i; k <= fim; k++) saida.push(...porQuestao(questoes[k], k + 1, k === i));
    i = fim + 1;
  }
  const aviso = avisoFinal?.trim();
  if (aviso) saida.push({ tipo: "aviso", texto: aviso });
  return saida;
}

/** Itens do enunciado formatado: parágrafos com texto, linha, caixa não vazia e figuras no lugar. */
function itensDoConteudo<F extends FiguraRef>(doc: DocConteudo, figuras: F[]): ItemFolha<F>[] {
  const saida: ItemFolha<F>[] = [];
  let primeiro = true;
  for (const n of doc.content ?? []) {
    if (n.type === "paragraph") {
      if (!temTexto(n)) continue;
      saida.push({ tipo: "noConteudo", no: n, primeiro });
    } else if (n.type === "horizontalRule") {
      saida.push({ tipo: "noConteudo", no: n, primeiro });
    } else if (n.type === "caixa") {
      const ps = (n.content ?? []).filter((p) => p.type === "paragraph" && temTexto(p));
      if (!ps.length) continue;
      saida.push({ tipo: "noConteudo", no: { ...n, content: ps }, primeiro });
    } else if (n.type === "figura") {
      const id = n.attrs?.imagemId;
      const al = n.attrs?.alinhamento;
      saida.push({
        tipo: "figura",
        figura: typeof id === "string" ? figuras.find((x) => x.id === id) : undefined,
        alinhamento: typeof al === "string" ? al : undefined,
        legenda: typeof n.attrs?.legenda === "string" ? n.attrs.legenda.trim() : "",
        naAlternativa: false,
      });
    } else {
      continue;
    }
    primeiro = false;
  }
  return saida;
}

/**
 * Parágrafos do texto antigo; linhas seguidas de tabela em markdown viram uma tabela. Com figura no
 * enunciado a tabela sai: na importação ela costuma ser a própria figura recortada, e sairia duas vezes.
 */
function itensComTabelas<F>(linhas: Segmento[][], temFigura: boolean): ItemFolha<F>[] {
  const saida: ItemFolha<F>[] = [];
  let tabela: string[][] = [];
  let paragrafos = 0;
  const fecharTabela = () => {
    if (tabela.length && !temFigura) saida.push({ tipo: "tabela", linhas: tabela });
    tabela = [];
  };
  for (const linha of linhas) {
    const celulas = celulasTabela(linha.map((seg) => seg.texto).join(""));
    if (celulas) {
      if (celulas.length) tabela.push(celulas);
      continue;
    }
    fecharTabela();
    saida.push({ tipo: "paragrafo", segmentos: linha, indice: paragrafos++ });
  }
  fecharTabela();
  return saida;
}

/**
 * Enunciado: formatado (`conteudo`) ou markdown com crédito separado; figuras soltas vão depois do texto.
 * No markdown com figura, o comando repetido no fim do texto sai dele e vai depois da figura.
 */
function enunciado<F extends FiguraRef>(q: QuestaoBase<F>): { textos: ItemFolha<F>[]; credito: string | null; soltas: F[]; comando: string } {
  const doEnunciado = (q.figuras ?? []).filter((f) => f.alvo === "enunciado");
  if (q.conteudo?.content) {
    const usadas = new Set(imagensDoConteudo(q.conteudo));
    return {
      textos: itensDoConteudo(q.conteudo, doEnunciado),
      credito: null,
      soltas: doEnunciado.filter((f) => !usadas.has(f.id)),
      comando: comandoRepetido(q.enunciado, q.comando) ? "" : q.comando,
    };
  }
  const tela = enunciadoNaTela(q.enunciado, q.comando, false, doEnunciado.length > 0);
  const { corpo, credito } = separarCredito(tela.texto);
  return { textos: itensComTabelas<F>(blocosNaoVazios(corpo), doEnunciado.length > 0), credito, soltas: doEnunciado, comando: tela.comando };
}

function itensQuestao<F extends FiguraRef>(q: QuestaoBase<F>, n: number, primeiraDoBloco: boolean): ItemFolha<F>[] {
  const { textos, credito, soltas, comando } = enunciado(q);
  const origem = q.origem?.trim() || null;
  const saida: ItemFolha<F>[] = [{ tipo: "titulo", numero: n, primeiraDoBloco }, ...textos];
  for (const f of soltas) saida.push({ tipo: "figura", figura: f, naAlternativa: false });
  if (credito || origem) saida.push({ tipo: "credito", credito, origem });
  blocosNaoVazios(markdownParaBlocos(comando)).forEach((segmentos, indice) => {
    saida.push({ tipo: "comando", segmentos, indice, comTexto: textos.length > 0 });
  });
  for (const a of q.alternativas) {
    saida.push({ tipo: "alternativa", letra: a.letra, texto: a.texto, conteudo: a.conteudo });
    const letra = a.letra.trim().toUpperCase();
    for (const f of q.figuras ?? []) {
      if (f.alvo === letra) saida.push({ tipo: "figura", figura: f, alinhamento: "esquerda", naAlternativa: true });
    }
  }
  return saida;
}

function itensResolucao<F extends FiguraRef>(q: QuestaoBase<F>, n: number, primeiraDoBloco: boolean): ItemFolha<F>[] {
  const saida: ItemFolha<F>[] = [{ tipo: "titulo", numero: n, primeiraDoBloco }];
  blocosNaoVazios(markdownParaBlocos(q.resolucao ?? "")).forEach((segmentos, indice) => {
    saida.push({ tipo: "resolucao", segmentos, indice });
  });
  saida.push({ tipo: "resposta", letra: q.resposta?.trim() || null });
  return saida;
}

/** Itens da prova do aluno, na ordem em que saem na folha. */
export function itensProva<F extends FiguraRef>(questoes: QuestaoBase<F>[], avisoFinal?: string | null): ItemFolha<F>[] {
  return comFaixas(questoes, itensQuestao, avisoFinal);
}

/** Itens do gabarito comentado, na ordem em que saem na folha. */
export function itensGabarito<F extends FiguraRef>(questoes: QuestaoBase<F>[], avisoFinal?: string | null): ItemFolha<F>[] {
  return comFaixas(questoes, itensResolucao, avisoFinal);
}
