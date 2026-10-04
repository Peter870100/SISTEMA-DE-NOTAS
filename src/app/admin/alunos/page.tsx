import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { listarContasAluno } from "@/actions/contas-aluno";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAlunos } from "@/components/admin/GerenciarAlunos";

export const dynamic = "force-dynamic";

export default async function AlunosAdminPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) redirect("/");

  const [contas, turmas] = await Promise.all([listarContasAluno(), listarTurmasAcessiveis()]);
  // Uma opção por turma+ano (as turmas têm um registro por bimestre): fica o mais recente.
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { id: t.id, rotulo: `${t.nome} · ${t.ano_letivo}` }])).values()];

  return (
    <PageLayout crumb="Administração" titulo="Contas de aluno" subtitulo="Crie acessos, bloqueie contas e gere senhas novas." largura="max-w-6xl">
      <GerenciarAlunos contasIniciais={contas} turmas={opcoes} />
    </PageLayout>
  );
}
