import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TurmaDashboard } from "@/components/turma/TurmaDashboard";
import type { NotaCelula } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ turmaId: string }>;
};

export default async function TurmaPage({ params }: PageProps) {
  const { turmaId } = await params;

  const { data: turma } = await supabase
    .from("turmas")
    .select("*")
    .eq("id", turmaId)
    .maybeSingle();

  if (!turma) notFound();

  const [{ data: todasTurmas }, { data: colunas }, { data: alunos }] = await Promise.all([
    supabase.from("turmas").select("*").order("nome"),
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
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
      <TurmaDashboard
        turma={turma}
        todasTurmas={todasTurmas ?? [turma]}
        colunasIniciais={colunas ?? []}
        alunosIniciais={alunos ?? []}
        notasIniciais={notasComAutor}
      />
    </main>
  );
}
