import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { carregarRelatorioAluno, grupoDaTurma } from "@/lib/relatorios/dados";
import { mediaAprovacaoDaEscola } from "@/lib/relatorios/media";
import { RelatorioAluno } from "@/components/relatorios/RelatorioAluno";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ turmaId: string; alunoId: string }> };

export default async function RelatorioAlunoPage({ params }: PageProps) {
  const { turmaId, alunoId } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turma = await exigirTurmaDaEscola(professor, turmaId).catch(() => null);
  if (!turma) notFound();

  const g = grupoDaTurma(turma);
  const [dados, mediaAprovacao] = await Promise.all([
    carregarRelatorioAluno(g, alunoId).catch((e: unknown) => {
      if (e instanceof Error && e.message === "Aluno não encontrado nesta turma.") return null;
      throw e;
    }),
    mediaAprovacaoDaEscola(turma.escola_id),
  ]);
  if (!dados) notFound();
  return <RelatorioAluno turmaId={turmaId} dados={dados} mediaAprovacao={mediaAprovacao} />;
}
