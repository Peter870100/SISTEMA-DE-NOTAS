import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { listarHistorico } from "@/actions/historico";
import { supabase } from "@/lib/supabase/client";
import { HistoricoTable } from "@/components/admin/HistoricoTable";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    redirect("/");
  }

  const [pagina, { data: turmas }, { data: professores }] = await Promise.all([
    listarHistorico(),
    supabase.from("turmas").select("id, nome").order("nome"),
    supabase.from("professores").select("id, nome").eq("role", "professor").order("nome"),
  ]);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6">
      <Link
        href="/admin/professores"
        className="flex w-fit items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Histórico de alterações
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Toda alteração de nota feita por professores (não-admin), mais recente primeiro.
      </p>

      <HistoricoTable
        linhasIniciais={pagina.linhas}
        cursorInicial={pagina.proximoCursor}
        turmas={turmas ?? []}
        professores={professores ?? []}
      />
    </main>
  );
}
