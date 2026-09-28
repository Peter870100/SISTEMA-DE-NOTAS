import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { ExportarBimestre } from "@/components/home/ExportarBimestre";
import { PageLayout } from "@/components/layout/PageLayout";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { getProfessorAtual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [professor, turmas, { data: alunos }] = await Promise.all([
    getProfessorAtual(),
    listarTurmasAcessiveis(),
    supabase.from("alunos").select("turma_id"),
  ]);

  const contagemPorTurma: Record<string, number> = {};
  for (const a of alunos ?? []) {
    contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
  }

  const primeiroNome = professor?.nome.trim().split(/\s+/)[0];

  return (
    <PageLayout
      crumb="Redação · Colégio Status"
      titulo="Suas turmas"
      subtitulo={primeiroNome ? `Olá, Prof. ${primeiroNome}. Escolha uma turma para lançar e acompanhar as notas.` : undefined}
      acoes={<ExportarBimestre turmas={turmas} />}
      largura="max-w-6xl"
    >
      <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
    </PageLayout>
  );
}
