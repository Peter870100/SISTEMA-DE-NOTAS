"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { AtividadeEvolucao } from "@/lib/desempenho/tipos";
import css from "./PainelDesempenho.module.css";

const TEXTO = "#0E1B3D";
const diaMes = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));

/** Caixa do tooltip: nome da atividade, data e "7 de 10". */
function Dica({ active, payload }: TooltipContentProps) {
  const a = active ? (payload?.[0]?.payload as (AtividadeEvolucao & { data: string }) | undefined) : undefined;
  if (!a) return null;
  return (
    <div className={css.dica}>
      <strong>{a.titulo}</strong>
      <span>{a.data} · {a.acertos} de {a.total} ({a.pct}%)</span>
    </div>
  );
}

/** Barras verticais da % de acerto por atividade, na ordem de entrega (eixo com a data dd/mm). */
export function GraficoEvolucao({ atividades }: { atividades: AtividadeEvolucao[] }) {
  const dados = atividades.map((a) => ({ ...a, data: diaMes(a.entregueEm) }));
  return (
    <div className={css.graficoEvolucao} role="img" aria-label={`Acerto em ${atividades.length} ${atividades.length === 1 ? "atividade" : "atividades"}, da mais antiga para a mais recente`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#DCE3F0" />
          <XAxis dataKey="data" tick={{ fontSize: 12, fill: TEXTO }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#DCE3F0" }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: TEXTO }} width={48} axisLine={false} tickLine={false} />
          <Tooltip content={Dica} cursor={{ fill: "rgb(4 68 160 / .06)" }} />
          <Bar dataKey="pct" fill="var(--color-brand)" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
