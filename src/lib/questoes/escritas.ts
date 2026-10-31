// src/lib/questoes/escritas.ts
// Núcleo puro das questões escritas pelo Claude (sem IA paga): entram pelo mesmo caminho do gerador.
import type { RespostaGeracao } from "./geracao";

export const ORIENTACAO_ESCRITAS = "Escrita pelo Claude (assinatura)";

export type QuestaoEscrita = {
  enunciado: string;
  comando: string;
  alternativas: { letra: "A" | "B" | "C" | "D" | "E"; texto: string }[];
  resposta: "A" | "B" | "C" | "D" | "E";
  resolucao: string;
};

export function escritasParaResposta(qs: QuestaoEscrita[]): RespostaGeracao {
  return {
    questoes: qs.map((q) => ({
      enunciado: q.enunciado,
      comando: q.comando,
      alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
      resposta: q.resposta,
      resolucao: q.resolucao,
      assunto_id: null,
    })),
  };
}

export function textoQuestoesSalvas(d: { geracaoId: string; ids: string[]; descartadas: number; link: string }): string {
  const n = d.ids.length;
  const linhas = [
    `${n} ${n === 1 ? "questão salva" : "questões salvas"} em revisão (lote ${d.geracaoId}):`,
    ...d.ids.map((id, i) => `${i + 1}. ${id}`),
  ];
  if (d.descartadas > 0) {
    linhas.push(`${d.descartadas} ${d.descartadas === 1 ? "descartada" : "descartadas"} (alternativas inválidas ou repetidas).`);
  }
  linhas.push(`Revisar: ${d.link}`);
  return linhas.join("\n");
}
