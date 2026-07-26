import { TrendingDown, TrendingUp, Users } from "lucide-react";

type KpiCardsProps = {
  totalAlunos: number;
  taxaCritico: number;
  mediaTurma: number | null;
};

function KpiCard({
  icone,
  corIcone,
  label,
  valor,
  corValor,
}: {
  icone: React.ReactNode;
  corIcone: string;
  label: string;
  valor: string;
  corValor?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${corIcone}`}>
        {icone}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
        <div
          className={`text-xl font-semibold tabular-nums ${
            corValor ?? "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {valor}
        </div>
      </div>
    </div>
  );
}

export function KpiCards({ totalAlunos, taxaCritico, mediaTurma }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        icone={<Users size={18} />}
        corIcone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        label="Total de Alunos"
        valor={String(totalAlunos)}
      />
      <KpiCard
        icone={<TrendingDown size={18} />}
        corIcone="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
        label="Taxa de Rendimento Crítico"
        valor={`${taxaCritico.toFixed(0)}%`}
        corValor="text-rose-600 dark:text-rose-400"
      />
      <KpiCard
        icone={<TrendingUp size={18} />}
        corIcone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        label="Média da Turma"
        valor={mediaTurma !== null ? mediaTurma.toFixed(2) : "—"}
      />
    </div>
  );
}
