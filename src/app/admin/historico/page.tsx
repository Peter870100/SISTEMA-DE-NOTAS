import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { listarHistorico } from "@/actions/historico";

export const dynamic = "force-dynamic";

function formatarValor(valor: number | null, status: string | null): string {
  if (valor !== null) return String(valor);
  if (status !== null) return status;
  return "—";
}

export default async function HistoricoPage() {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    redirect("/");
  }

  const historico = await listarHistorico();

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

      {historico.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma alteração registrada ainda.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Quando</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Professor</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Turma</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Aluno</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Atividade</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">De</th>
                <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">Para</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500 dark:text-neutral-400">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{h.professor_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{h.turma_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{h.aluno_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{h.atividade_titulo ?? "—"}</td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                    {formatarValor(h.valor_anterior, h.status_anterior)}
                  </td>
                  <td className="px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400">
                    {formatarValor(h.valor_novo, h.status_novo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
