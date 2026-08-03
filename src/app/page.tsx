import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ data: turmas, error }, { data: alunos }] = await Promise.all([
    supabase.from("turmas").select("*").order("nome").order("bimestre"),
    supabase.from("alunos").select("turma_id"),
  ]);

  const contagemPorTurma: Record<string, number> = {};
  for (const a of alunos ?? []) {
    contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
  }

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">AVALIA</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Selecione uma turma para lançar e acompanhar as notas do bimestre.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Não foi possível carregar as turmas: {error.message}
        </div>
      )}

      <TurmasLista turmas={turmas ?? []} contagemPorTurma={contagemPorTurma} />
    </main>
  );
}
