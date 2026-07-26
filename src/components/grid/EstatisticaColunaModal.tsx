"use client";

import { X } from "lucide-react";
import type { Aluno, AtividadeColuna } from "@/lib/types";
import type { CelulasMap } from "@/lib/celulas";
import { classificarStatus } from "@/lib/status";
import { mediaDeValores, paraEscala10 } from "@/lib/analytics";

type EstatisticaColunaModalProps = {
  coluna: AtividadeColuna | null;
  alunos: Aluno[];
  celulas: CelulasMap;
  onClose: () => void;
};

export function EstatisticaColunaModal({
  coluna,
  alunos,
  celulas,
  onClose,
}: EstatisticaColunaModalProps) {
  if (!coluna) return null;

  let ok = 0;
  let negativo = 0;
  let outro = 0;
  let semLancamento = 0;
  const valores: number[] = [];

  for (const aluno of alunos) {
    const cell = celulas[aluno.id]?.[coluna.id];
    if (!cell || (cell.valor === null && !cell.status_texto)) {
      semLancamento++;
      continue;
    }
    if (cell.valor !== null) {
      valores.push(cell.valor);
    } else if (cell.status_texto) {
      const classe = classificarStatus(cell.status_texto);
      if (classe === "positivo") ok++;
      else if (classe === "negativo") negativo++;
      else outro++;
    }
  }

  const media = mediaDeValores(valores);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {coluna.titulo}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Média da atividade
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {media !== null ? paraEscala10(media).toFixed(2) : "—"}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Notas lançadas
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {valores.length} / {alunos.length}
            </div>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">OK / entregue</span>
            <span className="font-medium text-emerald-600">{ok}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">
              Faltou / NF / não fez
            </span>
            <span className="font-medium text-rose-600">{negativo}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">Outro status</span>
            <span className="font-medium text-neutral-600 dark:text-neutral-300">{outro}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">
              Sem lançamento ainda
            </span>
            <span className="font-medium text-neutral-600 dark:text-neutral-300">
              {semLancamento}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
