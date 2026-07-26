import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: turmas, error } = await supabase
    .from("turmas")
    .select("*")
    .order("nome");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Planilha Viva — Notas de Redação
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Selecione uma turma para lançar e acompanhar as notas do bimestre.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Não foi possível carregar as turmas: {error.message}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {turmas?.map((turma) => (
          <li key={turma.id}>
            <Link
              href={`/turma/${turma.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm hover:border-blue-400 hover:shadow dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-700"
            >
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {turma.nome}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {turma.bimestre} · {turma.ano_letivo}
              </span>
            </Link>
          </li>
        ))}
        {turmas?.length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Nenhuma turma cadastrada ainda.
          </li>
        )}
      </ul>
    </main>
  );
}
