"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Turma } from "@/lib/types";
import { CriarBimestreModal } from "./CriarBimestreModal";

type BimestreAbasProps = {
  turma: Turma;
  todasTurmas: Turma[];
};

function proximoBimestre(atual: string): string {
  const m = atual.match(/(\d+)/);
  if (!m) return "";
  return atual.replace(/\d+/, String(parseInt(m[1], 10) + 1));
}

/** "1º Bimestre" → "1º Bim" pra caber nas abas. */
function rotuloCurto(bimestre: string): string {
  return bimestre.replace(/bimestre/i, "Bim").trim();
}

export function BimestreAbas({ turma, todasTurmas }: BimestreAbasProps) {
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
    () => todasTurmas.filter((t) => t.nome === turma.nome).sort((a, b) => a.bimestre.localeCompare(b.bimestre)),
    [todasTurmas, turma.nome]
  );

  function handleTrocarSerie(novoNome: string) {
    const mesmoBimestre = todasTurmas.find((t) => t.nome === novoNome && t.bimestre === turma.bimestre);
    const alvo = mesmoBimestre ?? todasTurmas.find((t) => t.nome === novoNome);
    if (alvo) router.push(`/turma/${alvo.id}`);
  }

  return (
    <>
      <select
        aria-label="Turma"
        value={turma.nome}
        onChange={(e) => handleTrocarSerie(e.target.value)}
        className="min-h-9 rounded-control border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-gold [&>option]:text-ink"
      >
        {seriesUnicas.map((t) => (
          <option key={t.nome} value={t.nome}>
            {t.nome}
          </option>
        ))}
      </select>

      <nav aria-label="Bimestres" className="flex items-center gap-0.5 rounded-control border border-white/15 bg-white/10 p-0.5">
        {bimestresDaTurma.map((t) => {
          const ativo = t.id === turma.id;
          return (
            <Link
              key={t.id}
              href={`/turma/${t.id}`}
              aria-current={ativo ? "page" : undefined}
              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
                ativo ? "bg-surface text-brand shadow-sm" : "text-frame-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {rotuloCurto(t.bimestre)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setCriarBimestreAberto(true)}
          aria-label="Criar novo bimestre para esta turma"
          title="Criar novo bimestre para esta turma"
          className="rounded-[8px] px-2 py-1.5 text-frame-muted hover:bg-white/10 hover:text-gold"
        >
          <Plus size={14} />
        </button>
      </nav>

      <CriarBimestreModal
        open={criarBimestreAberto}
        turmaId={turma.id}
        bimestreSugerido={proximoBimestre(turma.bimestre)}
        onClose={() => setCriarBimestreAberto(false)}
      />
    </>
  );
}
