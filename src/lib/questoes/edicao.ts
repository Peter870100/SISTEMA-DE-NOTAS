// Edição parcial de questão (tela e Hermes): funções puras, sem banco.
import type { Alternativa, Area, Letra, Questao } from "@/lib/types";
import { conteudoDeMarkdown, textoDoConteudo, type DocConteudo } from "./conteudo";
import { areaDaMateria, ehMateria, LETRAS, type Materia } from "./materias";

export type EdicaoQuestao = Partial<{
  enunciado: string;
  comando: string;
  alternativas: { letra: Letra; texto: string }[];
  resposta: Letra | null;
  anulada: boolean;
  materia: string;
  assunto_id: string | null;
}>;

export type QuestaoEditavel = Pick<Questao, "enunciado" | "conteudo" | "comando" | "alternativas" | "resposta" | "anulada" | "materia" | "status">;

export const AVISO_FORMATACAO_REINICIADA = "A formatação do enunciado foi reiniciada; as figuras voltaram para o fim do texto.";

/** Mesma regra da tela (`limpar`). */
export function exigirMateria(materia: string): Materia {
  if (!ehMateria(materia)) throw new Error("Escolha a matéria.");
  return materia;
}

/** Resolução comentada: ausente = não mexe; vazia = apaga (null); até 5.000 caracteres. */
export function limparResolucao(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t.length > 5000) throw new Error("A resolução pode ter até 5.000 caracteres.");
  return t || null;
}

/** Mesma regra da tela (`limpar`): letra de A a E, ou nenhuma. */
export function exigirResposta(resposta: Letra | null | undefined): Letra | null {
  if (resposta && !LETRAS.includes(resposta)) throw new Error("Resposta inválida.");
  return resposta || null;
}

/** Mesma regra da tela (`salvarQuestao`). */
export function exigirRespostaSePublicada(status: Questao["status"], anulada: boolean, resposta: Letra | null) {
  if (status === "publicada" && !anulada && !resposta) throw new Error("Questão publicada precisa de resposta (ou ser anulada).");
}

// Documento refeito do texto (negrito e itálico no formato antigo, com asteriscos); texto vazio = sem documento.
function docDoTexto(texto: string): DocConteudo | null {
  return texto ? conteudoDeMarkdown(texto) : null;
}

/**
 * Documentos (`conteudo`) depois de uma edição em texto puro. O renderizador usa o documento quando ele
 * existe; por isso, texto alterado num campo com documento refaz o documento a partir do texto novo.
 * As figuras deixam de ser citadas e o renderizador as mostra no fim. Campos não enviados ficam iguais.
 */
export function documentosAposEdicao(
  q: Pick<Questao, "enunciado" | "conteudo" | "alternativas">,
  e: EdicaoQuestao,
): { conteudo: DocConteudo | null; alternativas: Alternativa[]; avisos: string[] } {
  const avisos: string[] = [];
  let conteudo = q.conteudo;
  if (e.enunciado !== undefined && q.conteudo && e.enunciado.trim() !== q.enunciado.trim()) {
    conteudo = docDoTexto(e.enunciado.trim());
    avisos.push(AVISO_FORMATACAO_REINICIADA);
  }
  let alternativas = q.alternativas;
  if (e.alternativas !== undefined) {
    alternativas = LETRAS.map((letra) => {
      const atual = q.alternativas.find((a) => a.letra === letra) ?? { letra, texto: "" };
      const nova = e.alternativas!.find((a) => a.letra === letra);
      if (!nova || nova.texto.trim() === atual.texto.trim()) return atual;
      const texto = nova.texto.trim();
      if (!atual.conteudo) return { letra, texto };
      const doc = docDoTexto(texto);
      return doc ? { letra, texto: textoDoConteudo(doc).trim(), conteudo: doc } : { letra, texto };
    });
  }
  return { conteudo, alternativas, avisos };
}

type CamposEdicao = Partial<{
  enunciado: string;
  conteudo: DocConteudo | null;
  comando: string;
  alternativas: Alternativa[];
  resposta: Letra | null;
  anulada: boolean;
  materia: Materia;
  area: Area;
  assunto_id: string | null;
}>;

/**
 * Valida a edição (mesmas regras da tela) e devolve só as colunas que mudam. O assunto (que depende do
 * banco) é conferido em `editarQuestaoPor`.
 */
export function aplicarEdicao(q: QuestaoEditavel, e: EdicaoQuestao): { campos: CamposEdicao; avisos: string[] } {
  const campos: CamposEdicao = {};
  if (e.materia !== undefined) {
    const materia = exigirMateria(e.materia);
    campos.materia = materia;
    campos.area = areaDaMateria(materia);
  }
  if (e.alternativas !== undefined) {
    const vistas = new Set<string>();
    for (const a of e.alternativas) {
      if (!a || !LETRAS.includes(a.letra) || vistas.has(a.letra) || typeof a.texto !== "string") throw new Error("Alternativa inválida.");
      vistas.add(a.letra);
    }
  }
  if (e.resposta !== undefined) campos.resposta = exigirResposta(e.resposta);
  if (e.anulada !== undefined) campos.anulada = !!e.anulada;
  if (e.comando !== undefined) campos.comando = e.comando.trim();
  if (e.assunto_id !== undefined) campos.assunto_id = e.assunto_id || null;

  const docs = documentosAposEdicao(q, e);
  if (e.enunciado !== undefined) {
    if (docs.conteudo !== q.conteudo) {
      campos.conteudo = docs.conteudo;
      campos.enunciado = textoDoConteudo(docs.conteudo).trim();
    } else {
      campos.enunciado = q.conteudo ? q.enunciado : e.enunciado.trim();
    }
  }
  if (e.alternativas !== undefined) campos.alternativas = docs.alternativas;

  if (Object.keys(campos).length === 0) throw new Error("Nada para alterar.");
  if (e.resposta !== undefined || e.anulada !== undefined) {
    exigirRespostaSePublicada(q.status, campos.anulada ?? q.anulada, campos.resposta !== undefined ? campos.resposta : q.resposta);
  }
  return { campos, avisos: docs.avisos };
}
