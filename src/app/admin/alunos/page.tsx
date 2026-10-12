import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { listarContasAluno } from "@/actions/contas-aluno";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAlunos } from "@/components/admin/GerenciarAlunos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { CircleOff, Lock, UserCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AlunosAdminPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) redirect("/");

  const [contas, turmas] = await Promise.all([listarContasAluno(), listarTurmasAcessiveis()]);
  // Uma opção por turma+ano (as turmas têm um registro por bimestre): fica o mais recente.
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { id: t.id, rotulo: `${t.nome} · ${t.ano_letivo}` }])).values()];

  const painel: ItemResumo[] = [
    { rotulo: "Contas", valor: String(contas.length), detalhe: "de aluno na escola", Icone: Users },
    { rotulo: "Ativas", valor: String(contas.filter((c) => c.ativo).length), detalhe: "podem entrar", Icone: UserCheck },
    { rotulo: "Bloqueadas", valor: String(contas.filter((c) => !c.ativo).length), detalhe: "sem acesso", Icone: Lock },
    { rotulo: "Nunca entraram", valor: String(contas.filter((c) => !c.ultimo_acesso).length), detalhe: "ainda sem primeiro acesso", Icone: CircleOff },
  ];

  return (
    <PageLayout crumb="Administração" titulo="Contas de aluno" subtitulo="Crie acessos, bloqueie contas e gere senhas novas." largura="max-w-6xl">
      <PainelResumo itens={painel} />
      <GerenciarAlunos contasIniciais={contas} turmas={opcoes} />
    </PageLayout>
  );
}
