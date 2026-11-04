import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { questoesErradas } from "@/lib/desempenho/dados";
import { detalheDaUrl } from "@/lib/desempenho/url";
import { carregarPlano } from "@/lib/plano/dados";
import type { ConteudoPlano } from "@/lib/plano/tipos";
import { PainelDesempenho } from "@/components/desempenho/PainelDesempenho";

export const dynamic = "force-dynamic";

export default async function AlunoDesempenhoPage({ searchParams }: { searchParams: Promise<{ materia?: string | string[]; conteudo?: string | string[] }> }) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const busca = await searchParams;
  const chaveAberta = Array.isArray(busca.conteudo) ? busca.conteudo[0] : busca.conteudo;
  // Sempre a visão "aluno": só atividades com correção liberada.
  const { painel, respostas, plano, extras, regras } = await carregarPlano({ id: aluno.id, escolaId: aluno.escola_id }, "aluno", new Date(), chaveAberta);
  const { materia, conteudo } = detalheDaUrl(painel, busca);
  const erradas = conteudo ? await questoesErradas(respostas, conteudo) : [];
  const porChave: Record<string, ConteudoPlano> = Object.fromEntries([...plano.semana, ...plano.depois, ...plano.concluidos].map((c) => [c.chave, c]));

  return (
    <PainelDesempenho painel={painel} visao="aluno" titulo="Meu desempenho" hrefBase="/aluno/desempenho"
      materiaAberta={materia} conteudoAberto={conteudo} erradas={erradas} plano={porChave} extras={extras} regras={regras} />
  );
}
