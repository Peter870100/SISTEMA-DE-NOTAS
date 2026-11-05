import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { estudoParaTela } from "@/lib/estudos/dados";
import { podeEstudar } from "@/lib/estudos/situacao";
import { carregarPlano } from "@/lib/plano/dados";
import { chaveValida } from "@/lib/plano/extras";
import { PaginaEstudo, SemEstudo } from "@/components/estudos/PaginaEstudo";

export const dynamic = "force-dynamic";

export default async function EstudarPage({ params }: { params: Promise<{ assuntoId: string }> }) {
  const { assuntoId: chave } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const valida = chaveValida(chave);
  if (!valida || !("assuntoId" in valida)) notFound();
  if (!podeEstudar()) notFound();

  const leitura = await estudoParaTela(valida.assuntoId, aluno.id, aluno.escola_id);
  if (leitura.estado !== "publicado") return <SemEstudo estado={leitura.estado} />;

  // Falha no plano não esconde a explicação: cai em "fora do plano".
  let dados: Awaited<ReturnType<typeof carregarPlano>> | null = null;
  try {
    dados = await carregarPlano({ id: aluno.id, escolaId: aluno.escola_id }, "aluno", new Date(), valida.assuntoId);
  } catch (e) {
    console.error("estudar: carregarPlano:", e);
  }
  const plano = dados ? [...dados.plano.semana, ...dados.plano.depois, ...dados.plano.concluidos].find((c) => c.chave === valida.assuntoId) ?? null : null;
  return <PaginaEstudo estudo={leitura.estudo} plano={plano} extras={dados?.extras[valida.assuntoId]} regras={dados?.regras ?? null} />;
}
