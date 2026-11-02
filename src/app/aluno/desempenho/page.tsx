import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { aulasDoAlunoParaRevisao, questoesErradas, respostasDaConta } from "@/lib/desempenho/dados";
import { montarPainel } from "@/lib/desempenho/calculos";
import { detalheDaUrl } from "@/lib/desempenho/url";
import { PainelDesempenho } from "@/components/desempenho/PainelDesempenho";

export const dynamic = "force-dynamic";

export default async function AlunoDesempenhoPage({ searchParams }: { searchParams: Promise<{ materia?: string | string[]; conteudo?: string | string[] }> }) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const busca = await searchParams;
  // Sempre a visão "aluno": só atividades com correção liberada.
  const respostas = await respostasDaConta(aluno.id, aluno.escola_id, "aluno");
  const painel = montarPainel(respostas);
  const { materia, conteudo } = detalheDaUrl(painel, busca);
  const [erradas, aulas] = await Promise.all([
    conteudo ? questoesErradas(respostas, conteudo) : Promise.resolve([]),
    aulasDoAlunoParaRevisao(aluno.id, aluno.escola_id),
  ]);

  return (
    <PainelDesempenho painel={painel} visao="aluno" titulo="Meu desempenho" hrefBase="/aluno/desempenho"
      materiaAberta={materia} conteudoAberto={conteudo} erradas={erradas} aulas={aulas} />
  );
}
