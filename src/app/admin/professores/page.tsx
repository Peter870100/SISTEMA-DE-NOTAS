import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { listarProfessores, listarAcessoTurmasPorProfessor } from "@/actions/professores";
import { listarNomesTurmas } from "@/actions/turmas";
import { obterCodigoConvite } from "@/lib/configuracoes";
import { GerenciarProfessores } from "@/components/admin/GerenciarProfessores";
import { CodigoConvite } from "@/components/admin/CodigoConvite";
import { PageLayout } from "@/components/layout/PageLayout";
import { ehAdmin } from "@/lib/papeis";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) {
    redirect("/");
  }

  const [professores, codigoConvite, nomesTurmas, acessoPorProfessor] = await Promise.all([
    listarProfessores(),
    obterCodigoConvite(atual.escola_id),
    listarNomesTurmas(),
    listarAcessoTurmasPorProfessor(),
  ]);

  const painel: ItemResumo[] = [
    { rotulo: "Professores", valor: String(professores.length), detalhe: "com conta na escola", Icone: Users },
    { rotulo: "Administradores", valor: String(professores.filter((p) => ehAdmin(p.role)).length), detalhe: "gerenciam a escola", Icone: ShieldCheck },
    { rotulo: "Acesso restrito", valor: String(professores.filter((p) => p.acesso_restrito).length), detalhe: "veem só turmas liberadas", Icone: UserCog },
    { rotulo: "Senha provisória", valor: String(professores.filter((p) => p.senha_provisoria).length), detalhe: "ainda não trocaram", Icone: KeyRound },
  ];

  return (
    <PageLayout
      crumb="Administração"
      titulo="Gerenciar professores"
      subtitulo="Contas com acesso ao Avalia. Apenas administradores veem esta página."
      largura="max-w-6xl"
      acoes={
        <Link href="/admin/historico" className="inline-flex items-center gap-1.5 rounded-control border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
          <History size={15} />
          Histórico de alterações
        </Link>
      }
    >
      <PainelResumo itens={painel} />
      {codigoConvite && <CodigoConvite codigoInicial={codigoConvite} />}
      <GerenciarProfessores
        professoresIniciais={professores}
        nomesTurmas={nomesTurmas}
        acessoInicialPorProfessor={acessoPorProfessor}
      />
    </PageLayout>
  );
}
