"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Search, Users } from "lucide-react";
import type { Turma } from "@/lib/types";
import { corBimestre, partesDaTurma } from "@/lib/turmas";

type TurmasListaProps = {
  turmas: Turma[];
  contagemPorTurma: Record<string, number>;
};

export function TurmasLista({ turmas, contagemPorTurma }: TurmasListaProps) {
  const [busca, setBusca] = useState("");

  const grupos = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    const filtradas = alvo
      ? turmas.filter((t) => t.nome.toLowerCase().includes(alvo))
      : turmas;

    const mapa = new Map<string, Turma[]>();
    for (const turma of filtradas) {
      const { serie } = partesDaTurma(turma.nome);
      if (!mapa.has(serie)) mapa.set(serie, []);
      mapa.get(serie)!.push(turma);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [turmas, busca]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar turma..."
          className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {turmas.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nenhuma turma cadastrada ainda.
        </div>
      )}

      {turmas.length > 0 && grupos.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nenhuma turma encontrada pra &quot;{busca}&quot;.
        </div>
      )}

      {grupos.map(([serie, turmasDaSerie]) => (
        <div key={serie} className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            <GraduationCap size={16} className="text-blue-600" />
            {serie}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {turmasDaSerie.map((turma) => {
              const { resto } = partesDaTurma(turma.nome);
              const alunos = contagemPorTurma[turma.id] ?? 0;
              return (
                <Link
                  key={turma.id}
                  href={`/turma/${turma.id}`}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-700"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <BookOpen size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                      {resto ? `Turma ${resto}` : turma.nome}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${corBimestre(turma.bimestre)}`}
                      >
                        {turma.bimestre}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <Users size={11} />
                        {alunos}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
