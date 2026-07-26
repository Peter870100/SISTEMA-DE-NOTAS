"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Aluno, AtividadeColuna } from "@/lib/types";
import { classificarStatus, type ValorCelula } from "@/lib/status";
import { paraEscala10 } from "@/lib/analytics";
import { Avatar } from "@/components/ui/Avatar";

type AlunoDashboardDrawerProps = {
  aluno: Aluno | null;
  colunas: AtividadeColuna[];
  celulas: Record<string, ValorCelula>;
  mediaTurma: number | null;
  onClose: () => void;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

export function AlunoDashboardDrawer({
  aluno,
  colunas,
  celulas,
  mediaTurma,
  onClose,
}: AlunoDashboardDrawerProps) {
  const dadosGrafico = useMemo(
    () =>
      colunas.map((c) => ({
        nome: c.titulo,
        valor: celulas[c.id]?.valor ?? null,
      })),
    [colunas, celulas]
  );

  const { mediaAluno, entregas, pendencias } = useMemo(() => {
    let soma = 0;
    let contNota = 0;
    let entregas = 0;
    let pendencias = 0;
    for (const c of colunas) {
      const cell = celulas[c.id];
      if (!cell) continue;
      if (cell.valor !== null) {
        soma += cell.valor;
        contNota++;
        entregas++;
      } else if (cell.status_texto) {
        const classe = classificarStatus(cell.status_texto);
        if (classe === "positivo") entregas++;
        else if (classe === "negativo") pendencias++;
      }
    }
    return {
      mediaAluno: contNota > 0 ? soma / contNota : null,
      entregas,
      pendencias,
    };
  }, [colunas, celulas]);

  if (!aluno) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-5 shadow-xl dark:bg-neutral-900">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar nome={aluno.nome} size="md" />
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {aluno.nome}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Rendimento no bimestre
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Média do aluno"
            value={mediaAluno !== null ? paraEscala10(mediaAluno).toFixed(2) : "—"}
          />
          <StatTile
            label="Média da turma"
            value={mediaTurma !== null ? paraEscala10(mediaTurma).toFixed(2) : "—"}
          />
          <StatTile label="Entregas" value={`${entregas} / ${colunas.length}`} />
          <StatTile label="Faltas/Pendências" value={String(pendencias)} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Evolução por atividade
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGrafico} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="evolucaoAlunoGradiente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-neutral-800" vertical={false} />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-neutral-400"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  domain={[0, 1000]}
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-neutral-400"
                  width={36}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  formatter={(value) => (value == null ? "—" : value)}
                />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#evolucaoAlunoGradiente)"
                  dot={{ r: 4, fill: "#2563eb" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
