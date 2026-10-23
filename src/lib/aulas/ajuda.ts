import { supabase } from "@/lib/supabase/client";
import { mesmaEscola } from "@/lib/escola-regras";
import type { AtorEscola } from "@/lib/simulados/ator";

/**
 * Zera o progresso de um aluno numa aula: a linha de `aula_progresso` vai para a Lixeira (tipo
 * `progresso_aula`, restaurável). Conta e curso da aula precisam ser da escola do ator. Devolve o id
 * do item na Lixeira.
 */
export async function zerarProgressoAulaPor(ator: AtorEscola, contaId: string, aulaId: string): Promise<string> {
  const { data: conta, error: erroConta } = await supabase.from("alunos_contas").select("escola_id").eq("id", contaId).maybeSingle();
  if (erroConta) throw new Error(erroConta.message);
  if (!conta || !mesmaEscola(conta, ator.escola_id)) throw new Error("Conta não encontrada.");

  const { data: aula, error: erroAula } = await supabase.from("aulas").select("curso_id").eq("id", aulaId).maybeSingle();
  if (erroAula) throw new Error(erroAula.message);
  if (!aula) throw new Error("Aula não encontrada.");
  const { data: curso, error: erroCurso } = await supabase.from("cursos").select("escola_id").eq("id", aula.curso_id).maybeSingle();
  if (erroCurso) throw new Error(erroCurso.message);
  if (!curso || !mesmaEscola(curso, ator.escola_id)) throw new Error("Aula não encontrada.");

  const { data: progresso, error: erroProgresso } = await supabase.from("aula_progresso").select("aula_id").eq("conta_id", contaId).eq("aula_id", aulaId).maybeSingle();
  if (erroProgresso) throw new Error(erroProgresso.message);
  if (!progresso) throw new Error("Esse aluno ainda não tem progresso nessa aula.");

  const { data, error } = await supabase.rpc("lixeira_excluir_progresso", { p_conta: contaId, p_aula: aulaId, p_ator: ator.id, p_via: ator.via });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível mandar o progresso para a Lixeira.");
  return data as string;
}
