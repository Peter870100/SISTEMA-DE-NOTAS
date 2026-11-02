import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";

/** Chave da matéria na URL (a mesma de `porMateria`). */
export const chaveMateria = (c: Pick<ConteudoDesempenho, "materia">) => c.materia ?? "sem_materia";

/** Link da matéria aberta e, se houver, do conteúdo aberto: `${hrefBase}?materia=…&conteudo=…`. */
export function linkDetalhe(hrefBase: string, materia: string, conteudo?: string | null): string {
  const busca = new URLSearchParams({ materia });
  if (conteudo) busca.set("conteudo", conteudo);
  return `${hrefBase}?${busca.toString()}`;
}
