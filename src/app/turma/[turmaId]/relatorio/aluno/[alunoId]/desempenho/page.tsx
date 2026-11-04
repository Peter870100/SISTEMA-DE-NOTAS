import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { exigirTurmaDaEscola } from "@/lib/escola-acesso";
import { AlunoForaDoGrupo, contaDoAlunoDaTurma, grupoDaTurma } from "@/lib/relatorios/dados";
import { TEXTO_SEM_CONTA } from "@/lib/relatorios/calculos";
import { questoesErradas } from "@/lib/desempenho/dados";
import { montarPainel } from "@/lib/desempenho/calculos";
import { detalheDaUrl } from "@/lib/desempenho/url";
import { carregarPlano } from "@/lib/plano/dados";
import { REGRAS_PADRAO } from "@/lib/plano/regras";
import type { ConteudoPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import type { ExtrasConteudo } from "@/lib/plano/extras";
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
  const chaveAberta = Array.isArray(busca.conteudo) ? busca.conteudo[0] : busca.conteudo;
  let painel = montarPainel([]);
  let respostas: Awaited<ReturnType<typeof carregarPlano>>["respostas"] = [];
  let porChave: Record<string, ConteudoPlano> = {};
  let extras: Record<string, ExtrasConteudo> = {};
  let regras: RegrasAprendizagem = REGRAS_PADRAO;
  if (aluno.contaId) {
    const d = await carregarPlano({ id: aluno.contaId, escolaId: g.escolaId }, "escola", new Date(), chaveAberta);
    ({ painel, respostas, extras, regras } = d);
    porChave = Object.fromEntries([...d.plano.semana, ...d.plano.depois, ...d.plano.concluidos].map((c) => [c.chave, c]));
  }
  const { materia, conteudo } = detalheDaUrl(painel, busca);
  const erradas = conteudo ? await questoesErradas(respostas, conteudo) : [];

  return (
    <PageLayout crumb={`Relatório · ${turma.nome}`} titulo={aluno.nome} subtitulo="Desempenho por conteúdo, somando simulados e treinos"
      acoes={<Link href={voltar.href} className={ui.botaoSecundario}><ArrowLeft size={15} />{voltar.rotulo}</Link>}>
      <PainelDesempenho painel={painel} visao="escola" titulo={titulo} hrefBase={hrefBase}
        materiaAberta={materia} conteudoAberto={conteudo} erradas={erradas} plano={porChave} extras={extras} regras={regras}
        textoSemHistorico={aluno.contaId ? undefined : TEXTO_SEM_CONTA} />
    </PageLayout>
  );
}
