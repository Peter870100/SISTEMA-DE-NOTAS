import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { carregarRelatorioTurma, grupoDaTurma } from "@/lib/relatorios/dados";
import { RelatorioTurma } from "@/components/relatorios/RelatorioTurma";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ turmaId: string }> };

export default async function RelatorioTurmaPage({ params }: PageProps) {
  const { turmaId } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turma = await exigirTurmaDaEscola(professor, turmaId).catch(() => null);
  if (!turma) notFound();

  const g = grupoDaTurma(turma);
  const dados = await carregarRelatorioTurma(g);
  return <RelatorioTurma turmaId={turmaId} dados={dados} />;
}
