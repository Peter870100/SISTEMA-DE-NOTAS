import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { listarTurmasAcessiveis } from "@/actions/turmas";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [turmas, { data: alunos }] = await Promise.all([
    listarTurmasAcessiveis(),
    supabase.from("alunos").select("turma_id"),
  ]);

  const contagemPorTurma: Record<string, number> = {};
  for (const a of alunos ?? []) {
    contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
  }

  return (
    <>
      <Image
        src="/banner-cabecalho.png"
        alt="Status Avalia — Avaliação inteligente com secretária virtual"
        width={2172}
        height={724}
        className="w-full h-auto"
        priority
      />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Selecione uma turma para lançar e acompanhar as notas do bimestre.
        </p>

        <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
      </main>
    </>
  );
}
