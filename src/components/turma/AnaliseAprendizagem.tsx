"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Aluno, AtividadeColuna } from "@/lib/types";
import type { CelulasMap } from "@/lib/celulas";
import {
  indicadorTendencia,
  mediaAluno,
  mediaDeValores,
  paraEscala10,
} from "@/lib/analytics";
import { Avatar } from "@/components/ui/Avatar";

type AnaliseAprendizagemProps = {
  colunas: AtividadeColuna[];
  alunos: Aluno[];
  celulas: CelulasMap;
};

function nomeCurto(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

export function AnaliseAprendizagem({ colunas, alunos, celulas }: AnaliseAprendizagemProps) {
  const evolucaoTurma = useMemo(
    () =>
      colunas.map((c) => {
        const valores = alunos
          .map((a) => celulas[a.id]?.[c.id]?.valor)
          .filter((v): v is number => v !== null && v !== undefined);
        const media = mediaDeValores(valores);
        return {
          nome: c.titulo,
          media: media !== null ? Number(paraEscala10(media).toFixed(2)) : null,
        };
      }),
    [colunas, alunos, celulas]
  );

  const rankingAlunos = useMemo(() => {
    return alunos
      .map((a) => ({ nome: nomeCurto(a.nome), media: mediaAluno(celulas[a.id]) }))
      .filter((r): r is { nome: string; media: number } => r.media !== null)
      .sort((a, b) => b.media - a.media)
      .slice(0, 10)
      .map((r) => ({ nome: r.nome, media: Number(paraEscala10(r.media).toFixed(1)) }));
  }, [alunos, celulas]);

  const alunosEmRisco = useMemo(() => {
    return alunos
      .map((a) => {
        const media = mediaAluno(celulas[a.id]);
        const indicador = indicadorTendencia(colunas, celulas[a.id]);
        return {
          id: a.id,
          nome: a.nome,
          score: media !== null ? paraEscala10(media) : null,
          indicador: indicador !== null ? paraEscala10(indicador) : null,
        };
      })
      .filter((r) => (r.score !== null && r.score < 6) || (r.indicador !== null && r.indicador <= -1))
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 6);
  }, [alunos, celulas, colunas]);

  return (
    <div className="flex w-full flex-col gap-4 lg:w-96 lg:shrink-0">
      <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        Análise de Aprendizagem
      </h2>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Evolução da Média da Turma
        </p>
        <div className="mt-2 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucaoTurma} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="evolucaoTurmaGradiente" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-neutral-200 dark:text-neutral-800"
              />
              <XAxis
                dataKey="nome"
                tick={false}
                stroke="currentColor"
                className="text-neutral-400"
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 9 }}
                width={22}
                stroke="currentColor"
                className="text-neutral-400"
              />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Area
                type="monotone"
                dataKey="media"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#evolucaoTurmaGradiente)"
                dot={{ r: 3, fill: "#2563eb" }}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Top 10 Melhores Alunos (Média Geral)
        </p>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingAlunos} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                domain={[0, 10]}
                tick={{ fontSize: 9 }}
                stroke="currentColor"
                className="text-neutral-400"
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={90}
                tick={{ fontSize: 9 }}
                stroke="currentColor"
                className="text-neutral-400"
              />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar
                dataKey="media"
                fill="#2563eb"
                radius={[0, 4, 4, 0]}
                barSize={13}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Alunos em Risco
        </p>
        {alunosEmRisco.length === 0 ? (
          <p className="text-xs text-neutral-400">Nenhum aluno em risco no momento.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {alunosEmRisco.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar nome={r.nome} />
                  <span className="truncate text-neutral-700 dark:text-neutral-300" title={r.nome}>
                    {r.nome}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium tabular-nums ${
                      r.score !== null && r.score < 6
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {r.score !== null ? r.score.toFixed(2) : "—"}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium tabular-nums ${
                      r.indicador !== null && r.indicador < 0
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {r.indicador !== null
                      ? `${r.indicador > 0 ? "+" : ""}${r.indicador.toFixed(1)}`
                      : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
