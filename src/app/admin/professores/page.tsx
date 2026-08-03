import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listarProfessores } from "@/actions/professores";
import { obterCodigoConvite } from "@/lib/configuracoes";
import { GerenciarProfessores } from "@/components/admin/GerenciarProfessores";
import { CodigoConvite } from "@/components/admin/CodigoConvite";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage() {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    redirect("/");
  }

  const [professores, codigoConvite] = await Promise.all([
    listarProfessores(),
    obterCodigoConvite(),
  ]);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Gerenciar professores
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Contas com acesso à Planilha Viva. Apenas administradores veem esta página.
      </p>
      {codigoConvite && (
        <div className="mt-6">
          <CodigoConvite codigoInicial={codigoConvite} />
        </div>
      )}
      <GerenciarProfessores professoresIniciais={professores} />
    </main>
  );
}
