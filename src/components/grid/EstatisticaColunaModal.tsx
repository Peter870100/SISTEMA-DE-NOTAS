"use client";

import type { Aluno, AtividadeColuna } from "@/lib/types";
import type { CelulasMap } from "@/lib/celulas";
import { classificarStatus } from "@/lib/status";
import { mediaDeValores, paraEscala10 } from "@/lib/analytics";
import { Modal } from "@/components/ui/Modal";

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
    <Modal open onClose={onClose} titulo={coluna.titulo}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-control border border-line bg-surface-sunken px-3 py-2">
          <div className="text-xs text-muted">Média da atividade</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">{media !== null ? paraEscala10(media).toFixed(2) : "—"}</div>
        </div>
        <div className="rounded-control border border-line bg-surface-sunken px-3 py-2">
          <div className="text-xs text-muted">Notas lançadas</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">
            {valores.length} / {alunos.length}
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex items-center justify-between">
          <span className="text-muted">OK / entregue</span>
          <span className="font-mono font-semibold tabular-nums text-ok">{ok}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted">Faltou / NF / não fez</span>
          <span className="font-mono font-semibold tabular-nums text-danger">{negativo}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted">Outro status</span>
          <span className="font-mono font-semibold tabular-nums text-ink">{outro}</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted">Sem lançamento ainda</span>
          <span className="font-mono font-semibold tabular-nums text-ink">{semLancamento}</span>
        </li>
      </ul>
    </Modal>
  );
}
