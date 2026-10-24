import { supabase } from "@/lib/supabase/client";
import { ehAdmin } from "@/lib/papeis";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { Curso } from "@/lib/types";

/**
 * Núcleo dos cursos com quem age explícito (`AtorEscola`): a tela passa o professor logado (via "app")
 * e a Hermes passa o dono na escola do curso (via "hermes"). Mesmas regras da tela.
 */

export type TurmaDoCurso = { turma_nome: string; ano_letivo: string };

/** Mesma regra de `podeEditarCurso`, sobre o ator: mesma escola e (autor ou admin). */
export function atorPodeEditarCurso(ator: AtorEscola, curso: Pick<Curso, "escola_id" | "professor_id">): boolean {
  if (curso.escola_id !== ator.escola_id) return false;
  return curso.professor_id === ator.id || ehAdmin(ator.role);
}

/** O curso, se o ator pode editá-lo; senão lança a mesma mensagem da tela. */
export async function cursoEditavelPor(ator: AtorEscola, cursoId: string): Promise<Curso> {
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle();
  if (!curso || !atorPodeEditarCurso(ator, curso)) throw new Error("Você não pode editar esse curso.");
  return curso;
}

/**
 * Substitui as turmas do curso. Só aceita turmas que o ator pode acessar (da escola dele, e liberadas
 * quando há restrição), mais as que o curso já tem (ex.: vinculadas pelo admin). `escolaId` vem do curso.
 */
export async function gravarTurmasDoCursoPor(ator: AtorEscola, cursoId: string, escolaId: string, turmas: TurmaDoCurso[]): Promise<void> {
  const [{ data: daEscola, error: erroEscola }, { data: atuais, error: erroAtuais }] = await Promise.all([
    supabase.from("turmas").select("nome, ano_letivo").eq("escola_id", ator.escola_id),
    supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", cursoId),
  ]);
  if (erroEscola) throw new Error(erroEscola.message);
  if (erroAtuais) throw new Error(erroAtuais.message);
  const acessiveis = (daEscola ?? []).filter((t) => ator.turmas === null || ator.turmas.has(t.nome));
  const permitidas = new Set([
    ...acessiveis.map((t) => `${t.nome}|${t.ano_letivo}`),
    ...(atuais ?? []).map((t) => `${t.turma_nome}|${t.ano_letivo}`),
  ]);
  const aceitas = turmas.filter((t) => permitidas.has(`${t.turma_nome}|${t.ano_letivo}`));
  const { error: erroApagar } = await supabase.from("curso_turmas").delete().eq("curso_id", cursoId);
  if (erroApagar) throw new Error(erroApagar.message);
  const unicas = [...new Map(aceitas.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t])).values()];
  if (unicas.length === 0) return;
  const { error } = await supabase
    .from("curso_turmas")
    .insert(unicas.map((t) => ({ curso_id: cursoId, escola_id: escolaId, turma_nome: t.turma_nome, ano_letivo: t.ano_letivo })));
  if (error) throw new Error(error.message);
}

/** Troca as turmas de um curso que o ator pode editar. */
export async function turmasDoCursoPor(ator: AtorEscola, cursoId: string, turmas: TurmaDoCurso[]): Promise<void> {
  const curso = await cursoEditavelPor(ator, cursoId);
  await gravarTurmasDoCursoPor(ator, cursoId, curso.escola_id, turmas);
}

/** Publica ou despublica uma aula de um curso que o ator pode editar. */
export async function publicarAulaPor(ator: AtorEscola, aulaId: string, publicada: boolean): Promise<void> {
  const { data: aula } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (!aula) throw new Error("Aula não encontrada.");
  await cursoEditavelPor(ator, aula.curso_id);
  if (publicada && aula.video_id && aula.duracao_seg == null) {
    throw new Error("Espere a prévia do vídeo carregar para registrar a duração.");
  }
  const { error } = await supabase
    .from("aulas")
    .update({ publicada, publicada_em: publicada ? aula.publicada_em ?? new Date().toISOString() : aula.publicada_em })
    .eq("id", aulaId);
  if (error) throw new Error(error.message);
}
