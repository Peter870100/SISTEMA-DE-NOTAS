import { Star, TrendingDown, Users } from "lucide-react";

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
  corValor = "text-ink",
  destaque = false,
}: {
  icone: React.ReactNode;
  corIcone: string;
  label: string;
  valor: string;
  corValor?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-card border border-white bg-surface px-4 py-3 shadow-[0_8px_28px_rgb(10_42_110_/_0.12)] ${destaque ? "border-t-[3px] border-t-gold" : ""}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${corIcone}`}>{icone}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className={`font-mono text-2xl font-semibold tabular-nums ${corValor}`}>{valor}</div>
      </div>
    </div>
  );
}

export function KpiCards({ totalAlunos, taxaCritico, mediaTurma }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard icone={<Users size={18} />} corIcone="bg-brand/10 text-brand" label="Total de alunos" valor={String(totalAlunos)} />
      <KpiCard
        icone={<TrendingDown size={18} />}
        corIcone="bg-danger/10 text-danger"
        label="Rendimento crítico"
        valor={`${taxaCritico.toFixed(0)}%`}
        corValor="text-danger"
      />
      <KpiCard
        icone={<Star size={18} />}
        corIcone="bg-gold/40 text-gold-ink"
        label="Média da turma"
        valor={mediaTurma !== null ? mediaTurma.toFixed(2) : "—"}
        corValor="text-brand"
        destaque
      />
    </div>
  );
}
