import type { Habilidade, MaterialRevisao, Topico } from "@/lib/types";
import {
  classificacaoDasQuestoes, contarQuestoesPorTopico, listarAulasParaMaterial, listarHabilidades, listarTodosMateriais,
  listarTodosPrerequisitos, listarTopicos, type AulaOpcao,
} from "./classificacao-servidor";

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

export type GerenciamentoClassificacao = {
  topicos: Topico[];
  habilidades: Habilidade[];
  /** Nº de questões por id de tópico (ausente = 0). */
  questoesPorTopico: Record<string, number>;
  prerequisitos: { topico_id: string; prerequisito_id: string }[];
  materiais: MaterialRevisao[];
  aulas: AulaOpcao[];
};

/** Dados da tela de gerenciar (dono). Null se a leitura falhar (ex.: tabelas novas ainda não criadas). */
export async function carregarGerenciamento(): Promise<GerenciamentoClassificacao | null> {
  try {
    const [topicos, habilidades, questoesPorTopico, prerequisitos, materiais] = await Promise.all([
      listarTopicos(), listarHabilidades(), contarQuestoesPorTopico(), listarTodosPrerequisitos(), listarTodosMateriais(),
    ]);
    const aulas = await listarAulasParaMaterial(materiais.flatMap((m) => (m.aula_id ? [m.aula_id] : [])));
    return { topicos, habilidades, questoesPorTopico, prerequisitos, materiais, aulas };
  } catch {
    return null;
  }
}
