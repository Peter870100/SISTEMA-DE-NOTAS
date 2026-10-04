import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClassificacaoSchema, RespostaPaginaSchema } from "./formato-ia";
import { MATERIAS } from "./materias";

export const MODELO = "claude-opus-5-5";
export const PRECO_ENTRADA_LOTE = 2 / 1_000_000;
export const PRECO_SAIDA_LOTE = 10 / 1_000_000;

let cliente: Anthropic | null = null;
export function clienteIA(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Configure ANTHROPIC_API_KEY na Vercel para usar a importação com IA.");
  cliente ??= new Anthropic();
  return cliente;
}

type AssuntoIA = { id: string; materia: string; nome: string };

function listaMaterias(): string {
  return Object.entries(MATERIAS).map(([k, v]) => `${k} (${v.rotulo}, área ${v.area})`).join("; ");
}

function listaAssuntos(assuntos: AssuntoIA[]): string {
  return assuntos.map((a) => `${a.id} | ${a.materia} | ${a.nome}`).join("\n");
}

export function instrucoesLeitura(banca: string, ano: number | null, caderno: string, assuntos: AssuntoIA[]): string {
  return [
    `Você está digitalizando uma prova objetiva (${banca}${ano ? ` ${ano}` : ""}${caderno ? `, ${caderno}` : ""}) para um banco de questões escolar.`,
    "A primeira imagem é a página a ler. A segunda (se houver) é a página seguinte, só para completar uma questão que continue nela. As demais são o gabarito oficial.",
    "Extraia APENAS as questões cujo número começa na primeira imagem. Copie o texto fielmente, em português, sem resumir; use **negrito** e *itálico* só onde a prova usa; mantenha quebras de parágrafo.",
    "enunciado = textos de apoio + enunciado. comando = a frase imediatamente antes das alternativas (\"\" se não houver). alternativas = A a E.",
    "resposta = letra do gabarito para esse número, ou null se não encontrar. anulada = true se o gabarito indicar anulação.",
    "figuras = cada figura, gráfico, mapa, tabela-imagem ou tirinha da primeira imagem, com o quadro em frações da página (x, y do canto superior esquerdo; w, h), e alvo = enunciado ou a letra da alternativa a que pertence.",
    `Matérias permitidas: ${listaMaterias()}.`,
    "assunto_id = o id de um assunto da lista abaixo que corresponda à matéria escolhida; se nenhum servir, assunto_id = null e assunto_novo = um nome curto de assunto.",
    "duvidas = frases curtas sobre qualquer incerteza (texto ilegível, figura cortada, questão incompleta); [] se nenhuma.",
    "Assuntos (id | matéria | nome):",
    listaAssuntos(assuntos),
  ].join("\n");
}

export function pedidoPagina(p: { customId: string; paginaUrl: string; proximaUrl: string | null; gabaritoUrls: string[]; instrucoes: string }) {
  const imagens = [p.paginaUrl, ...(p.proximaUrl ? [p.proximaUrl] : []), ...p.gabaritoUrls];
  return {
    custom_id: p.customId,
    params: {
      model: MODELO,
      max_tokens: 16000,
      output_config: { effort: "medium" as const, format: zodOutputFormat(RespostaPaginaSchema) },
      messages: [{
        role: "user" as const,
        content: [
          ...imagens.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
          { type: "text" as const, text: p.instrucoes },
        ],
      }],
    },
  };
}

export function pedidoClassificacao(customId: string, questoes: { id: string; area: string; enunciado: string; comando: string }[], assuntos: AssuntoIA[]) {
  const texto = [
    "Classifique cada questão do ENEM abaixo na matéria (lista fixa) e no assunto (lista de assuntos).",
    `Matérias permitidas: ${listaMaterias()}. A matéria precisa ser compatível com a área informada.`,
    "Responda um item por questão com o mesmo id. assunto_id da lista, ou null e assunto_novo com um nome curto.",
    "Assuntos (id | matéria | nome):",
    listaAssuntos(assuntos),
    "Questões:",
    ...questoes.map((q) => `### id=${q.id} área=${q.area}\n${q.enunciado.slice(0, 1500)}\n${q.comando}`),
  ].join("\n");
  return {
    custom_id: customId,
    params: {
      model: MODELO,
      max_tokens: 8000,
      output_config: { effort: "medium" as const, format: zodOutputFormat(ClassificacaoSchema) },
      messages: [{ role: "user" as const, content: texto }],
    },
  };
}

export function custoDoUso(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const entrada = u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return entrada * PRECO_ENTRADA_LOTE + u.output_tokens * PRECO_SAIDA_LOTE;
}

export function estimarCustoPaginas(paginas: number): number {
  return Math.round(paginas * (9000 * PRECO_ENTRADA_LOTE + 3000 * PRECO_SAIDA_LOTE) * 100) / 100;
}
