import Image from "next/image";
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
    <>
      <div className="relative w-full">
        <Image
          src="/banner-cabecalho.png"
          alt="Status Avalia — Avaliação inteligente com secretária virtual"
          width={2172}
          height={724}
          className="w-full h-auto"
          priority
        />
        <div
          aria-hidden="true"
          className="animate-piscar-brilho absolute left-[5.75%] top-[26.93%] w-[25.32%]"
          style={{
            aspectRatio: "550 / 220",
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 72%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Selecione uma turma para lançar e acompanhar as notas do bimestre.
        </p>

        {error && (
          <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Não foi possível carregar as turmas: {error.message}
          </div>
        )}

        <TurmasLista turmas={turmas ?? []} contagemPorTurma={contagemPorTurma} />
      </main>
    </>
  );
}
