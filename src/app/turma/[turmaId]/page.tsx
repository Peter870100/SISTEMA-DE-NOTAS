import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TurmaDashboard } from "@/components/turma/TurmaDashboard";
import { getProfessorAtual, professorTemAcessoATurma } from "@/lib/auth";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import type { NotaCelula } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ aluno?: string; t?: string }>;
};

export default async function TurmaPage({ params, searchParams }: PageProps) {
  const { turmaId } = await params;
  const { aluno: alunoParam, t } = await searchParams;

  const { data: turma } = await supabase
    .from("turmas")
    .select("*")
    .eq("id", turmaId)
    .maybeSingle();

  if (!turma) notFound();

  const professor = await getProfessorAtual();
  if (!professor || !(await professorTemAcessoATurma(professor, turma.nome))) {
    redirect("/");
  }

  const [todasTurmas, { data: colunas }, { data: alunos }] = await Promise.all([
    listarTurmasAcessiveis(),
    supabase
      .from("atividades_colunas")
      .select("*")
      .eq("turma_id", turmaId)
      .order("ordem"),
    supabase
      .from("alunos")
      .select("*")
      .eq("turma_id", turmaId)
      .order("ordem"),
  ]);

  const alunoIds = (alunos ?? []).map((a) => a.id);
  const { data: notas } = alunoIds.length
    ? await supabase
        .from("notas_celulas")
        .select("*, professores(nome)")
        .in("aluno_id", alunoIds)
    : { data: [] };

  type NotaComJoin = NotaCelula & { professores: { nome: string } | null };
  const notasComAutor = ((notas ?? []) as NotaComJoin[]).map(({ professores, ...resto }) => ({
    ...resto,
    professor_nome: professores?.nome ?? null,
  }));

  return (
    <TurmaDashboard
      turma={turma}
      todasTurmas={todasTurmas.length > 0 ? todasTurmas : [turma]}
      colunasIniciais={colunas ?? []}
      alunosIniciais={alunos ?? []}
      notasIniciais={notasComAutor}
      alunoFoco={alunoParam ? { id: alunoParam, chave: `${alunoParam}|${t ?? ""}` } : null}
    />
  );
}
