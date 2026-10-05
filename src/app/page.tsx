import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { PageLayout } from "@/components/layout/PageLayout";
import { turmasDaEscola } from "@/lib/escola-acesso";
import { getProfessorAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turmas = await turmasDaEscola(professor);

  const contagemPorTurma: Record<string, number> = {};
  const ids = turmas.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: alunos } = await supabase.from("alunos").select("turma_id").in("turma_id", ids.slice(i, i + 150));
    for (const a of alunos ?? []) {
      contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
    }
  }

  const primeiroNome = professor.nome.trim().split(/\s+/)[0];

  return (
    <PageLayout
      crumb="Redação · Colégio Status"
      titulo="Suas turmas"
      subtitulo={primeiroNome ? <><span className="mr-2">Olá, Prof. <strong className="font-heading text-xl font-bold uppercase tracking-[0.025em] text-gold">{primeiroNome}</strong>.</span><span>Escolha uma turma para lançar e acompanhar as notas.</span></> : undefined}
      largura="max-w-6xl"
    >
      <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
    </PageLayout>
  );
}
