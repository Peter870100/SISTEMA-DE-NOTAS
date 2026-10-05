"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, GraduationCap, Search, Users } from "lucide-react";
import type { Turma } from "@/lib/types";
import { corBimestre, partesDaTurma } from "@/lib/turmas";
import { SeloHermes } from "@/components/ui/SeloHermes";
import { ControleBimestre } from "@/components/turma/ControleBimestre";
import { SituacaoBimestre } from "@/components/turma/SituacaoBimestre";
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

    const mapa = new Map<string, Map<string, Turma[]>>();
    for (const turma of filtradas) {
      const { serie, resto } = partesDaTurma(turma.nome);
      if (!mapa.has(serie)) mapa.set(serie, new Map());
      const turmasDaSerie = mapa.get(serie)!;
      const chave = JSON.stringify([turma.escola_id, turma.ano_letivo, (resto || turma.nome).trim().toLocaleLowerCase("pt-BR")]);
      if (!turmasDaSerie.has(chave)) turmasDaSerie.set(chave, []);
      turmasDaSerie.get(chave)!.push(turma);
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
          <h2 className="flex w-fit items-center gap-2.5 rounded-r-control border-l-[3px] border-gold bg-white/85 px-3 py-2 font-heading text-xl font-bold uppercase tracking-[0.06em] text-brand shadow-sm">
            <GraduationCap size={20} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-brand" />
            {serie}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(turmasDaSerie.entries()).map(([chave, bimestres]) => {
              const primeira = bimestres[0];
              const { resto } = partesDaTurma(primeira.nome);
              const nome = resto ? `Turma ${resto}` : primeira.nome;
              const ordenados = [...bimestres].sort((a, b) => a.bimestre.localeCompare(b.bimestre, "pt-BR", { numeric: true }));
              return (
                <details key={chave} className="turma-card group self-start rounded-card border border-line bg-surface shadow-card">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright [&::-webkit-details-marker]:hidden">
                    <span className="turma-card-icone flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
                      <BookOpen size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display font-semibold text-ink">{nome}</span>
                      <span className="mt-1 block text-xs text-muted">{primeira.ano_letivo} · {bimestres.length} {bimestres.length === 1 ? "bimestre disponível" : "bimestres disponíveis"}</span>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-brand transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-line-soft px-3 py-3">
                    {ordenados.map((turma) => (
                      <div key={turma.id} className={`flex flex-col gap-2 rounded-control border p-2 ${turma.bimestre_encerrado ? "border-red-200 bg-red-50/70" : "border-line-soft bg-white"}`}>
                      <Link href={`/turma/${turma.id}`} aria-label={`Abrir ${nome}, ${serie}, ${turma.bimestre}`} className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-line-soft bg-white px-3 py-2 transition hover:border-brand-bright/50 hover:bg-surface-sunken">
                        <span className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 text-xs font-semibold ${turma.bimestre_encerrado ? "bg-red-100 text-red-700" : corBimestre(turma.bimestre)}`}>{turma.bimestre}</span><SituacaoBimestre turma={turma} /></span>
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted"><Users size={12} aria-hidden="true" />{contagemPorTurma[turma.id] ?? 0}</span>
                          {turma.criado_via === "hermes" && <SeloHermes />}
                        </span>
                      </Link>
                      <ControleBimestre turma={turma} />
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
