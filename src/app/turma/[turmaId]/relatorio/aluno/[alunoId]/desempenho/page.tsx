import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { AlunoForaDoGrupo, contaDoAlunoDaTurma, grupoDaTurma } from "@/lib/relatorios/dados";
import { TEXTO_SEM_CONTA } from "@/lib/relatorios/calculos";
import { questoesErradas, respostasDaConta } from "@/lib/desempenho/dados";
import { montarPainel } from "@/lib/desempenho/calculos";
import { detalheDaUrl } from "@/lib/desempenho/url";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos as ui } from "@/components/ui/estilos";
import { PainelDesempenho } from "@/components/desempenho/PainelDesempenho";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ turmaId: string; alunoId: string }>;
  searchParams: Promise<{ materia?: string | string[]; conteudo?: string | string[] }>;
};

export default async function DesempenhoDoAlunoPage({ params, searchParams }: PageProps) {
  const { turmaId, alunoId } = await params;
  const busca = await searchParams;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turma = await exigirTurmaDaEscola(professor, turmaId).catch(() => null);
  if (!turma) notFound();

  const g = grupoDaTurma(turma);
  const aluno = await contaDoAlunoDaTurma(g, alunoId).catch((e: unknown) => {
    if (e instanceof AlunoForaDoGrupo) return null;
    throw e;
  });
  if (!aluno) notFound();

  const hrefBase = `/turma/${turmaId}/relatorio/aluno/${alunoId}/desempenho`;
  const voltar = { href: `/turma/${turmaId}/relatorio/aluno/${alunoId}`, rotulo: "Relatório do aluno" };
  const titulo = `Desempenho de ${aluno.nome}`;

  // Sem conta: cabeçalho e aviso, sem consultar respostas.
  const respostas = aluno.contaId ? await respostasDaConta(aluno.contaId, g.escolaId, "escola") : [];
  const painel = montarPainel(respostas);
  const { materia, conteudo } = detalheDaUrl(painel, busca);
  const erradas = conteudo ? await questoesErradas(respostas, conteudo) : [];

  return (
    <PageLayout crumb={`Relatório · ${turma.nome}`} titulo={aluno.nome} subtitulo="Desempenho por conteúdo, somando simulados e treinos"
      acoes={<Link href={voltar.href} className={ui.botaoSecundario}><ArrowLeft size={15} />{voltar.rotulo}</Link>}>
      <PainelDesempenho painel={painel} visao="escola" titulo={titulo} hrefBase={hrefBase}
        materiaAberta={materia} conteudoAberto={conteudo} erradas={erradas} aulas={[]}
        textoSemHistorico={aluno.contaId ? undefined : TEXTO_SEM_CONTA} />
    </PageLayout>
  );
}
