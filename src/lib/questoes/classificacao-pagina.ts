import type { Habilidade, Topico } from "@/lib/types";
import { classificacaoDasQuestoes, listarHabilidades, listarTopicos } from "./classificacao-servidor";

export type ClassificacaoTela = {
  topicos: Topico[];
  habilidades: Habilidade[];
  /** Tópico e habilidades já gravados na questão (vazio em questão nova). */
  atual: { topicoId: string | null; habilidadeIds: string[] };
};

/**
 * Dados para os campos de classificação de uma página do banco. Devolve null se a leitura falhar
 * (ex.: tabelas novas ainda não criadas): a página segue funcionando, só sem esses campos.
 */
export async function carregarClassificacaoTela(questaoId: string | null): Promise<ClassificacaoTela | null> {
  try {
    const [topicos, habilidades, mapa] = await Promise.all([
      listarTopicos(),
      listarHabilidades(),
      questaoId ? classificacaoDasQuestoes([questaoId]) : Promise.resolve(null),
    ]);
    return { topicos, habilidades, atual: mapa?.get(questaoId!) ?? { topicoId: null, habilidadeIds: [] } };
  } catch {
    return null;
  }
}
