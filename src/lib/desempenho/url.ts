import type { PainelDesempenho } from "./tipos";

type Param = string | string[] | undefined;
const primeiro = (v: Param): string | null => (Array.isArray(v) ? v[0] : v) || null;

/** Matéria e conteúdo abertos pela URL; valores inexistentes (ou de outra matéria) viram null. */
export function detalheDaUrl(painel: PainelDesempenho, busca: { materia?: Param; conteudo?: Param }): { materia: string | null; conteudo: string | null } {
  const chaveConteudo = primeiro(busca.conteudo);
  let materia = painel.materias.find((m) => m.materia === primeiro(busca.materia)) ?? null;
  if (!materia && chaveConteudo) materia = painel.materias.find((m) => m.conteudos.some((c) => c.chave === chaveConteudo)) ?? null;
  const conteudo = materia?.conteudos.find((c) => c.chave === chaveConteudo) ?? null;
  return { materia: materia?.materia ?? null, conteudo: conteudo?.chave ?? null };
}
