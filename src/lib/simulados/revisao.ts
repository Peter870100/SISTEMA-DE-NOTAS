export type InfoQuestao = { materia: string | null; assuntoId: string | null; assuntoNome: string | null };
export type ItemRevisar = { chave: string; materia: string | null; assuntoId: string | null; assuntoNome: string | null; erros: number; total: number };

/** Assuntos com erro no simulado (sem assunto, agrupa pela matéria): mais erros primeiro, depois pior aproveitamento. */
export function assuntosParaRevisar(itens: { questaoId: string; correta: boolean; anulada: boolean }[], info: Map<string, InfoQuestao>, limite = 6): ItemRevisar[] {
  const grupos = new Map<string, ItemRevisar>();
  for (const it of itens) {
    const q = info.get(it.questaoId);
    if (it.anulada || !q || (!q.assuntoId && !q.materia)) continue;
    const chave = q.assuntoId ?? `materia:${q.materia}`;
    const g = grupos.get(chave) ?? { chave, materia: q.materia, assuntoId: q.assuntoId, assuntoNome: q.assuntoNome, erros: 0, total: 0 };
    g.total += 1;
    if (!it.correta) g.erros += 1;
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .filter((g) => g.erros > 0)
    // Empate: assunto com nome (mais específico) antes do grupo só da matéria.
    .sort((a, b) => b.erros - a.erros || b.erros / b.total - a.erros / a.total || Number(!a.assuntoNome) - Number(!b.assuntoNome) || (a.assuntoNome ?? "").localeCompare(b.assuntoNome ?? "", "pt-BR"))
    .slice(0, limite);
}

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Aulas cujo título cita o assunto (sem acento/maiúscula); no máximo 2. */
export function aulasDoTema<T extends { titulo: string }>(assunto: string | null, aulas: T[]): T[] {
  const alvo = normalizar(assunto ?? "");
  if (!alvo) return [];
  return aulas.filter((a) => normalizar(a.titulo).includes(alvo)).slice(0, 2);
}
