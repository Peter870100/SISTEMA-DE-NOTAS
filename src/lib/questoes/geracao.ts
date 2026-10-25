// src/lib/questoes/geracao.ts
// Funções puras do gerador de questões por IA (sem imports de servidor).
import { z } from "zod";
import type { Database, Escopo } from "@/lib/types";
import { LETRAS, areaDaMateria, type Materia } from "./materias";

const LETRA = z.enum(["A", "B", "C", "D", "E"]);

export const GeracaoSchema = z.object({
  questoes: z.array(z.object({
    enunciado: z.string(),
    comando: z.string(),
    alternativas: z.array(z.object({ letra: LETRA, texto: z.string() })),
    resposta: LETRA,
    resolucao: z.string(),
    assunto_id: z.string().nullable(),
  })),
});
export type RespostaGeracao = z.infer<typeof GeracaoSchema>;

export const LIMIAR_PARECENCA = 0.55;

export type Referencia = { rotulo: string; texto: string };

export type ContextoGeradas = {
  escopo: Escopo;
  escola_id: string | null;
  materia: Materia;
  assuntoPedido: string | null;
  assuntosValidos: Set<string>;
  referencias: Referencia[];
  geracao_id: string;
  criado_por: string;
  ano: number;
};

function trigramas(texto: string): Set<string> {
  const palavras = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < palavras.length; i++) out.add(palavras.slice(i, i + 3).join(" "));
  return out;
}

// Jaccard de trigramas de palavras; menos de 3 palavras em qualquer lado → 0.
export function parecenca(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  for (const t of ta) if (tb.has(t)) comuns++;
  return comuns / (ta.size + tb.size - comuns);
}

type Insert = Database["public"]["Tables"]["questoes"]["Insert"];

export function respostaParaGeradas(r: RespostaGeracao, ctx: ContextoGeradas): { linhas: Insert[]; descartadas: number } {
  const linhas: Insert[] = [];
  const textosAnteriores: string[] = [];
  let descartadas = 0;

  for (const q of r.questoes) {
    const letras = q.alternativas.map((a) => a.letra).sort().join("");
    const valida =
      q.enunciado.trim() !== "" &&
      q.alternativas.length === LETRAS.length &&
      letras === LETRAS.join("") &&
      q.alternativas.every((a) => a.texto.trim() !== "");
    if (!valida) {
      descartadas++;
      continue;
    }

    const texto = `${q.enunciado} ${q.comando}`;
    let motivo: string | null = null;
    const ref = ctx.referencias.find((x) => parecenca(texto, x.texto) >= LIMIAR_PARECENCA);
    if (ref) motivo = `Parecida demais com ${ref.rotulo}.`;
    else if (textosAnteriores.some((t) => parecenca(texto, t) >= LIMIAR_PARECENCA)) motivo = "Parecida demais com outra questão gerada.";
    textosAnteriores.push(texto);

    const assunto_id = q.assunto_id && ctx.assuntosValidos.has(q.assunto_id) ? q.assunto_id : ctx.assuntoPedido;
    const porLetra = new Map(q.alternativas.map((a) => [a.letra, a.texto.trim()]));
    linhas.push({
      escopo: ctx.escopo,
      escola_id: ctx.escola_id,
      banca: "Gerada por IA",
      ano: ctx.ano,
      caderno: "",
      numero: null,
      area: areaDaMateria(ctx.materia),
      materia: ctx.materia,
      assunto_id,
      enunciado: q.enunciado.trim(),
      comando: q.comando.trim(),
      alternativas: LETRAS.map((letra) => ({ letra, texto: porLetra.get(letra) ?? "" })),
      resposta: q.resposta,
      anulada: false,
      status: "revisao",
      precisa_revisao: motivo !== null,
      motivo_revisao: motivo,
      origem: "ia",
      resolucao: q.resolucao.trim(),
      geracao_id: ctx.geracao_id,
      criado_por: ctx.criado_por,
    });
  }
  return { linhas, descartadas };
}
