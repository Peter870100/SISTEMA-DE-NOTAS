import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { carregarPlano } from "@/lib/plano/dados";
import { PlanoEstudo } from "@/components/plano/PlanoEstudo";

export const dynamic = "force-dynamic";

export default async function AlunoPlanoPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const dados = await carregarPlano({ id: aluno.id, escolaId: aluno.escola_id }, "aluno");
  return <PlanoEstudo dados={dados} />;
}
