import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { listarProfessores, listarAcessoTurmasPorProfessor } from "@/actions/professores";
import { listarNomesTurmas } from "@/actions/turmas";
import { obterCodigoConvite } from "@/lib/configuracoes";
import { GerenciarProfessores } from "@/components/admin/GerenciarProfessores";
import { CodigoConvite } from "@/components/admin/CodigoConvite";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage() {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    redirect("/");
  }

  const [professores, codigoConvite, nomesTurmas, acessoPorProfessor] = await Promise.all([
    listarProfessores(),
    obterCodigoConvite(),
    listarNomesTurmas(),
    listarAcessoTurmasPorProfessor(),
  ]);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Gerenciar professores
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Contas com acesso ao Avalia. Apenas administradores veem esta página.
          </p>
        </div>
        <Link
          href="/admin/historico"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          <History size={15} />
          Histórico de alterações
        </Link>
      </div>
      {codigoConvite && (
        <div className="mt-6">
          <CodigoConvite codigoInicial={codigoConvite} />
        </div>
      )}
      <GerenciarProfessores
        professoresIniciais={professores}
        nomesTurmas={nomesTurmas}
        acessoInicialPorProfessor={acessoPorProfessor}
      />
    </main>
  );
}
