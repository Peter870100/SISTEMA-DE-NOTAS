import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { AlunoForaDoGrupo, carregarRelatorioAluno, grupoDaTurma } from "@/lib/relatorios/dados";
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
  const dados = await carregarRelatorioAluno(g, alunoId).catch((e: unknown) => {
    if (e instanceof AlunoForaDoGrupo) return null;
    throw e;
  });
  if (!dados) notFound();
  return <RelatorioAluno turmaId={turmaId} dados={dados} />;
}
