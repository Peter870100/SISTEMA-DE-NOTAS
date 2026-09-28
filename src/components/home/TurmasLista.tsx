"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Search, Users } from "lucide-react";
import type { Turma } from "@/lib/types";
import { corBimestre, partesDaTurma } from "@/lib/turmas";
import { SeloHermes } from "@/components/ui/SeloHermes";
import { estilos } from "@/components/ui/estilos";

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
      <div className={`${estilos.card} relative p-2`}>
        <Search
          size={16}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          aria-label="Buscar turma"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar turma…"
          className={`${estilos.input} border-transparent bg-surface-sunken pl-9`}
        />
      </div>

      {turmas.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          Nenhuma turma cadastrada ainda.
        </div>
      )}

      {turmas.length > 0 && grupos.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          Nenhuma turma encontrada pra &quot;{busca}&quot;.
        </div>
      )}

      {grupos.map(([serie, turmasDaSerie]) => (
        <div key={serie} className="flex flex-col gap-2.5">
          <h2 className={`flex items-center gap-1.5 ${estilos.rotulo}`}>
            <GraduationCap size={16} className="text-brand" />
            {serie}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {turmasDaSerie.map((turma) => {
              const { resto } = partesDaTurma(turma.nome);
              const alunos = contagemPorTurma[turma.id] ?? 0;
              return (
                <Link
                  key={turma.id}
                  href={`/turma/${turma.id}`}
                  className="group flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-bright/50 hover:shadow-[0_14px_36px_rgb(10_42_110_/_0.14)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
                    <BookOpen size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold text-ink">
                      {resto ? `Turma ${resto}` : turma.nome}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${corBimestre(turma.bimestre)}`}
                      >
                        {turma.bimestre}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted">
                        <Users size={11} />
                        {alunos}
                      </span>
                      {turma.criado_via === "hermes" && <SeloHermes />}
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
