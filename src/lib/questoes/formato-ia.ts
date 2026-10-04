// src/lib/questoes/formato-ia.ts
import { z } from "zod";
import type { AlvoImagem, Area, Database, Escopo } from "@/lib/types";
import { MATERIAS, areaDaMateria, ehMateria } from "./materias";
import { limitarQuadro } from "./quadro";

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const MATERIA = z.enum(Object.keys(MATERIAS) as [string, ...string[]]);

export const RespostaPaginaSchema = z.object({
  questoes: z.array(z.object({
    numero: z.number().int(),
    enunciado: z.string(),
    comando: z.string(),
    alternativas: z.array(z.object({ letra: LETRA, texto: z.string() })),
    resposta: LETRA.nullable(),
    anulada: z.boolean(),
    area: z.enum(["linguagens", "humanas", "natureza", "matematica"]),
    materia: MATERIA,
    assunto_id: z.string().nullable(),
    assunto_novo: z.string().nullable(),
    figuras: z.array(z.object({ alvo: z.enum(["enunciado", "A", "B", "C", "D", "E"]), x: z.number(), y: z.number(), w: z.number(), h: z.number() })),
    duvidas: z.array(z.string()),
  })),
});
export type RespostaPagina = z.infer<typeof RespostaPaginaSchema>;

export const ClassificacaoSchema = z.object({
  itens: z.array(z.object({ id: z.string(), materia: MATERIA, assunto_id: z.string().nullable(), assunto_novo: z.string().nullable() })),
});
export type Classificacao = z.infer<typeof ClassificacaoSchema>;

export type ContextoPagina = {
  escopo: Escopo;
  escola_id: string | null;
  banca: string;
  ano: number | null;
  caderno: string;
  importacao_id: string;
  pagina_id: string;
  numerosExistentes: Set<number>;
  assuntos: Map<string, string>; // id → matéria (só aprovados)
};

export type NovaQuestao = {
  linha: Database["public"]["Tables"]["questoes"]["Insert"];
  imagens: { alvo: AlvoImagem; x: number; y: number; w: number; h: number }[];
  assuntoNovo: { materia: string; nome: string } | null;
};

export function respostaParaQuestoes(resposta: RespostaPagina, ctx: ContextoPagina): { questoes: NovaQuestao[]; avisos: string[] } {
  const questoes: NovaQuestao[] = [];
  const avisos: string[] = [];
  for (const q of resposta.questoes) {
    if (ctx.numerosExistentes.has(q.numero)) {
      avisos.push(`Questão ${q.numero} já existe e foi ignorada.`);
      continue;
    }
    ctx.numerosExistentes.add(q.numero);

    const motivos: string[] = [...q.duvidas];
    if (!q.enunciado.trim()) motivos.push("Enunciado vazio.");
    if (q.numero < 1) motivos.push("Número da questão inválido.");
    for (const a of q.alternativas) {
      if (!a.texto.trim() && !q.figuras.some((f) => f.alvo === a.letra)) motivos.push(`Alternativa ${a.letra} sem conteúdo.`);
    }
    const letras = q.alternativas.map((a) => a.letra).join("");
    if (q.alternativas.length !== 5 || letras !== "ABCDE") motivos.push("A questão precisa ter 5 alternativas (A a E).");
    if (!q.resposta && !q.anulada) motivos.push("Resposta não encontrada no gabarito.");

    let assunto_id: string | null = null;
    if (q.assunto_id) {
      if (ctx.assuntos.get(q.assunto_id) === q.materia) assunto_id = q.assunto_id;
      else motivos.push("Assunto sugerido não confere com a matéria.");
    }
    const novo = !assunto_id && q.assunto_novo?.trim() ? { materia: q.materia, nome: q.assunto_novo.trim() } : null;
    if (novo) motivos.push(`Assunto novo proposto: ${novo.nome}.`);
    else if (!assunto_id) motivos.push("Sem assunto.");

    const materia = q.materia;
    const area: Area = ehMateria(materia) ? areaDaMateria(materia) : q.area;
    questoes.push({
      linha: {
        escopo: ctx.escopo,
        escola_id: ctx.escola_id,
        banca: ctx.banca,
        ano: ctx.ano,
        caderno: ctx.caderno,
        numero: q.numero,
        area,
        materia,
        assunto_id,
        enunciado: q.enunciado.trim(),
        comando: q.comando.trim(),
        alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto.trim() })),
        resposta: q.resposta,
        anulada: q.anulada,
        status: "revisao",
        precisa_revisao: motivos.length > 0,
        motivo_revisao: motivos.length ? motivos.join(" ") : null,
        origem: "pdf",
        importacao_id: ctx.importacao_id,
        pagina_id: ctx.pagina_id,
      },
      imagens: q.figuras.map((f) => ({ alvo: f.alvo, ...limitarQuadro(f) })),
      assuntoNovo: novo,
    });
  }
  return { questoes, avisos };
}

export function classificacaoParaAtualizacoes(c: Classificacao, assuntos: Map<string, string>, idsEsperados: Set<string>) {
  const vistos = new Set<string>();
  return c.itens.filter((i) => {
    if (!idsEsperados.has(i.id) || vistos.has(i.id)) return false;
    vistos.add(i.id);
    return true;
  }).map((i) => {
    const assunto_id = i.assunto_id && assuntos.get(i.assunto_id) === i.materia ? i.assunto_id : null;
    const assuntoNovo = !assunto_id && i.assunto_novo?.trim() ? i.assunto_novo.trim() : null;
    return {
      id: i.id,
      materia: i.materia,
      area: areaDaMateria(i.materia as keyof typeof MATERIAS),
      assunto_id,
      assuntoNovo,
      precisa: !assunto_id,
    };
  });
}
