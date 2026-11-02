import { podeEditarQuestao, type Ator } from "./regras";
import type { Area, Escopo } from "@/lib/types";

/** Máximo de questões por chamada (lote e MCP). */
export const LIMITE_LOTE = 50;

export type ItemLote = { questaoId: string; topicoId?: string | null; habilidadeIds?: string[] };
export type QuestaoLote = {
  id: string; assunto_id: string | null; area: Area; escopo: Escopo; escola_id: string | null; criado_por: string | null;
};
export type Recusa = { questaoId: string; motivo: string };

/** Minúsculas, sem acento e sem espaços nas pontas. */
export function nomeNormalizado(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Separa os itens do lote que podem ser gravados dos recusados (com o motivo). */
export function validarItens(
  itens: ItemLote[],
  questoes: Map<string, QuestaoLote>,
  topicos: Map<string, { assunto_id: string }>,
  habilidades: Map<string, { area: Area }>,
  ator: Ator,
): { aceitos: ItemLote[]; recusados: Recusa[] } {
  if (itens.length > LIMITE_LOTE) throw new Error(`No máximo ${LIMITE_LOTE} questões por vez.`);
  const aceitos: ItemLote[] = [];
  const recusados: Recusa[] = [];
  for (const item of itens) {
    const recusar = (motivo: string) => recusados.push({ questaoId: item.questaoId, motivo });
    const q = questoes.get(item.questaoId);
    if (!q) { recusar("Questão não encontrada."); continue; }
    if (!podeEditarQuestao(ator, q)) { recusar("Sem permissão para editar esta questão."); continue; }
    if (item.topicoId) {
      const t = topicos.get(item.topicoId);
      if (!t) { recusar("Tópico não encontrado."); continue; }
      if (t.assunto_id !== q.assunto_id) { recusar("O tópico é de outro assunto."); continue; }
    }
    let motivoHab: string | null = null;
    for (const hid of item.habilidadeIds ?? []) {
      const h = habilidades.get(hid);
      if (!h) { motivoHab = "Habilidade não encontrada."; break; }
      if (h.area !== q.area) { motivoHab = "A habilidade é de outra área."; break; }
    }
    if (motivoHab) { recusar(motivoHab); continue; }
    aceitos.push(item);
  }
  return { aceitos, recusados };
}

/** Assunto comum a todas as questões, ou null (vazio, misto ou sem assunto). */
export function mesmoAssunto(qs: QuestaoLote[]): string | null {
  const primeiro = qs[0]?.assunto_id ?? null;
  return primeiro && qs.every((q) => q.assunto_id === primeiro) ? primeiro : null;
}

/** Área comum a todas as questões, ou null. */
export function mesmaArea(qs: QuestaoLote[]): Area | null {
  const primeira = qs[0]?.area ?? null;
  return primeira && qs.every((q) => q.area === primeira) ? primeira : null;
}

/** Habilidades resultantes, sem repetidas e em ordem estável. */
export function habilidadesFinais(atuais: string[], novas: string[], modo: "adicionar" | "trocar"): string[] {
  const base = modo === "trocar" ? novas : [...atuais, ...novas];
  return [...new Set(base)];
}

/** Ao juntar tópicos: nome igual no destino junta; nome novo é movido. */
export function planoJuntarTopicos(
  origem: { id: string; nome: string }[],
  destino: { id: string; nome: string }[],
): { mover: string[]; juntar: { de: string; para: string }[] } {
  const porNome = new Map(destino.map((d) => [nomeNormalizado(d.nome), d.id]));
  const mover: string[] = [];
  const juntar: { de: string; para: string }[] = [];
  for (const o of origem) {
    const para = porNome.get(nomeNormalizado(o.nome));
    if (para) juntar.push({ de: o.id, para });
    else mover.push(o.id);
  }
  return { mover, juntar };
}
