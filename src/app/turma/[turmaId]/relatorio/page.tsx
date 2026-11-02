import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { carregarRelatorioTurma, grupoDaTurma } from "@/lib/relatorios/dados";
import { respostasDaTurma } from "@/lib/desempenho/dados";
import { maisErro, porConteudo } from "@/lib/desempenho/calculos";
import type { ConteudoDesempenho } from "@/lib/desempenho/tipos";
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
  // Falha nos conteúdos não derruba o relatório: a seção mostra um aviso.
  const [dados, respostas] = await Promise.all([
    carregarRelatorioTurma(g),
    respostasDaTurma(g).catch((e: unknown) => {
      console.error("relatório da turma: conteúdos com mais erro", e);
      return null;
    }),
  ]);
  const conteudos: ConteudoDesempenho[] = respostas ? maisErro(porConteudo(respostas, "respostas")) : [];
  const avisoConteudos = respostas ? undefined : "Não foi possível carregar os conteúdos agora. Tente novamente em instantes.";
  return <RelatorioTurma turmaId={turmaId} dados={dados} conteudos={conteudos} avisoConteudos={avisoConteudos} />;
}
