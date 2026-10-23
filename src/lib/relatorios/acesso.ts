/** Grupo de turma e permissão dos relatórios (puro: sem Supabase, testável sem variáveis de ambiente). */
import { podeVerTurma, type Escopo } from "@/lib/mcp/escopo";

/** Uma turma com todos os seus bimestres: escola + nome + ano letivo. */
export type GrupoTurma = { escolaId: string; nome: string; anoLetivo: string };

export function grupoDaTurma(turma: { escola_id: string; nome: string; ano_letivo: string }): GrupoTurma {
  return { escolaId: turma.escola_id, nome: turma.nome, anoLetivo: turma.ano_letivo };
}

/** True se quem pergunta (Hermes) pode ver o relatório do grupo: dono sempre; professor só nas turmas liberadas da escola dele. */
export function podeVerGrupo(escopo: Escopo, g: GrupoTurma): boolean {
  return podeVerTurma(escopo, g.escolaId, g.nome);
}
