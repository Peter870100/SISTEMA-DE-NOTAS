import { supabase } from "@/lib/supabase/client";
import type { AlunoConta, Aula, AulaProgresso, Curso, Modulo } from "@/lib/types";
import { cursosDoAluno } from "@/lib/aulas/acesso";
import { porcentagemConjunto } from "@/lib/aulas/progresso";

export type AulaResumo = Aula & { qtd_material: number; qtd_gabarito: number };
export type ModuloComAulas = Modulo & { aulas: AulaResumo[] };

export async function arvoreDoCurso(cursoId: string, somentePublicadas: boolean): Promise<ModuloComAulas[]> {
  let consultaAulas = supabase.from("aulas").select("*").eq("curso_id", cursoId).order("ordem");
  if (somentePublicadas) consultaAulas = consultaAulas.eq("publicada", true);
  const [{ data: modulos }, { data: aulas }] = await Promise.all([
    supabase.from("modulos").select("*").eq("curso_id", cursoId).order("ordem"),
    consultaAulas,
  ]);
  const ids = (aulas ?? []).map((a) => a.id);
  const { data: arquivos } = ids.length
    ? await supabase.from("aula_arquivos").select("aula_id, tipo").in("aula_id", ids)
    : { data: [] as { aula_id: string; tipo: string }[] };

  const contagem = new Map<string, { material: number; gabarito: number }>();
  for (const a of arquivos ?? []) {
    const c = contagem.get(a.aula_id) ?? { material: 0, gabarito: 0 };
    if (a.tipo === "gabarito") c.gabarito++;
    else c.material++;
    contagem.set(a.aula_id, c);
  }
  return (modulos ?? []).map((m) => ({
    ...m,
    aulas: (aulas ?? [])
      .filter((a) => a.modulo_id === m.id)
      .map((a) => ({ ...a, qtd_material: contagem.get(a.id)?.material ?? 0, qtd_gabarito: contagem.get(a.id)?.gabarito ?? 0 })),
  }));
}

export async function progressoDoAluno(contaId: string, cursoId: string): Promise<Map<string, AulaProgresso>> {
  const { data } = await supabase.from("aula_progresso").select("*").eq("conta_id", contaId).eq("curso_id", cursoId);
  return new Map((data ?? []).map((p) => [p.aula_id, p]));
}

export type ResumoCursoAluno = {
  curso: Curso;
  professor_nome: string | null;
  porcentagem: number;
  qtd_modulos: number;
  qtd_aulas: number;
  continuar: { aula_id: string; titulo: string } | null;
};

export async function resumosCursosAluno(aluno: AlunoConta): Promise<ResumoCursoAluno[]> {
  const cursos = await cursosDoAluno(aluno);
  if (cursos.length === 0) return [];
  const idsProfessores = [...new Set(cursos.map((c) => c.professor_id).filter((id): id is string => !!id))];
  const { data: professores } = idsProfessores.length
    ? await supabase.from("professores").select("id, nome").in("id", idsProfessores)
    : { data: [] as { id: string; nome: string }[] };
  const nomes = new Map((professores ?? []).map((p) => [p.id, p.nome]));

  return Promise.all(
    cursos.map(async (curso) => {
      const [arvore, progresso] = await Promise.all([arvoreDoCurso(curso.id, true), progressoDoAluno(aluno.id, curso.id)]);
      const aulas = arvore.flatMap((m) => m.aulas);
      const concluidas = aulas.filter((a) => progresso.get(a.id)?.concluida_em).length;
      const emAndamento = aulas
        .filter((a) => progresso.has(a.id) && !progresso.get(a.id)!.concluida_em)
        .sort((x, y) => Date.parse(progresso.get(y.id)!.atualizado_em) - Date.parse(progresso.get(x.id)!.atualizado_em))[0];
      const proxima = emAndamento ?? aulas.find((a) => !progresso.get(a.id)?.concluida_em);
      return {
        curso,
        professor_nome: curso.professor_id ? nomes.get(curso.professor_id) ?? null : null,
        porcentagem: porcentagemConjunto(concluidas, aulas.length),
        qtd_modulos: arvore.filter((m) => m.aulas.length > 0).length,
        qtd_aulas: aulas.length,
        continuar: proxima ? { aula_id: proxima.id, titulo: proxima.titulo } : null,
      };
    })
  );
}
