"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Turma } from "@/lib/types";
import { CriarBimestreModal } from "./CriarBimestreModal";

type FiltrosTurmaProps = {
  turma: Turma;
  todasTurmas: Turma[];
};

function proximoBimestre(atual: string): string {
  const m = atual.match(/(\d+)/);
  if (!m) return "";
  return atual.replace(/\d+/, String(parseInt(m[1], 10) + 1));
}

export function FiltrosTurma({ turma, todasTurmas }: FiltrosTurmaProps) {
  const router = useRouter();
  const [criarBimestreAberto, setCriarBimestreAberto] = useState(false);

  const seriesUnicas = useMemo(() => {
    const vistos = new Set<string>();
    return todasTurmas.filter((t) => {
      if (vistos.has(t.nome)) return false;
      vistos.add(t.nome);
      return true;
    });
  }, [todasTurmas]);

  const bimestresDaTurma = useMemo(
    () =>
      todasTurmas
        .filter((t) => t.nome === turma.nome)
        .sort((a, b) => a.bimestre.localeCompare(b.bimestre)),
    [todasTurmas, turma.nome]
  );

  function handleTrocarSerie(novoNome: string) {
    const mesmoBimestre = todasTurmas.find(
      (t) => t.nome === novoNome && t.bimestre === turma.bimestre
    );
    const alvo = mesmoBimestre ?? todasTurmas.find((t) => t.nome === novoNome);
    if (alvo) router.push(`/turma/${alvo.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={turma.nome}
        onChange={(e) => handleTrocarSerie(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {seriesUnicas.map((t) => (
          <option key={t.nome} value={t.nome}>
            Série: {t.nome}
          </option>
        ))}
      </select>

      <select
        value={turma.id}
        onChange={(e) => router.push(`/turma/${e.target.value}`)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {bimestresDaTurma.map((t) => (
          <option key={t.id} value={t.id}>
            Bimestre: {t.bimestre}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setCriarBimestreAberto(true)}
        title="Criar novo bimestre para esta turma"
        className="flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-600 dark:border-neutral-700 dark:text-neutral-400"
      >
        <Plus size={14} />
        Bimestre
      </button>

      <CriarBimestreModal
        open={criarBimestreAberto}
        turmaId={turma.id}
        bimestreSugerido={proximoBimestre(turma.bimestre)}
        onClose={() => setCriarBimestreAberto(false)}
      />
    </div>
  );
}
