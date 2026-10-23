"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AcertoMateria } from "@/lib/relatorios/tipos";
import type { PontoBimestre, PontoSimulado } from "@/lib/relatorios/apresentacao";
import { formatarNota } from "@/lib/relatorios/calculos";
import css from "./Relatorio.module.css";

const AZUL = "#0444A0";
const AZUL_CLARO = "#8DB4EA";
const TEXTO = "#293B5B";
const OK = "#0E9F6E";
const DANGER = "#D6264A";
const TOOLTIP = { fontSize: 13, borderRadius: 10, border: "1px solid #DCE3F0", boxShadow: "0 8px 28px rgb(10 42 110 / 0.12)" };
const TICK = { fontSize: 12, fill: TEXTO };

function Vazio({ texto }: { texto: string }) {
  return <p className="py-6 text-sm text-ink">{texto}</p>;
}

function Cartao({ titulo, className = "", children }: { titulo: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${css.cartao} ${className}`}>
      <h2 className="font-display text-base font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

type Props = { bimestres: PontoBimestre[]; materias: AcertoMateria[]; simulados: PontoSimulado[]; mediaAprovacao: number; semConta: boolean };

export function GraficosAluno({ bimestres, materias, simulados, mediaAprovacao, semConta }: Props) {
  const temBimestres = bimestres.some((b) => b.media !== null);
  const mats = materias.map((m) => ({ nome: m.rotulo + (m.poucas ? " *" : ""), pct: Math.round(m.pct) }));
  const rotuloMedia = `Média ${formatarNota(mediaAprovacao)}`;
  const temAndamento = bimestres.some((b) => b.andamento && b.media !== null);

  return (
    <div className={css.grade}>
      <Cartao titulo="Notas por bimestre">
        {!temBimestres ? (
          <Vazio texto="Ainda não há notas lançadas para este aluno." />
        ) : (
          <>
            <div className={`mt-2 h-60 w-full ${css.graficoFixo}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bimestres} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAEFF7" />
                  <XAxis dataKey="nome" tick={TICK} interval={0} />
                  <YAxis domain={[0, 10]} tick={TICK} width={36} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v) => [String(v).replace(".", ","), "Nota"]} />
                  <ReferenceLine y={mediaAprovacao} stroke={DANGER} strokeDasharray="5 4" label={{ value: rotuloMedia, position: "insideTopRight", fill: DANGER, fontSize: 12 }} />
                  <Bar dataKey="media" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                    {bimestres.map((b) => (
                      <Cell key={b.nome} fill={b.andamento ? AZUL_CLARO : AZUL} stroke={b.andamento ? AZUL : undefined} strokeDasharray={b.andamento ? "4 3" : undefined} strokeWidth={b.andamento ? 2 : 0} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {temAndamento && <p className="mt-2 text-xs text-ink">Barra clara tracejada: bimestre em andamento.</p>}
          </>
        )}
      </Cartao>

      <Cartao titulo="Acerto por matéria">
        {mats.length === 0 ? (
          <Vazio texto={semConta ? "Sem conta de login, não há simulados nem treinos para calcular o acerto." : "Ainda não há simulados ou treinos entregues para calcular o acerto por matéria."} />
        ) : (
          <>
            <div className={`mt-2 w-full ${css.graficoFixo}`} style={{ height: Math.max(160, mats.length * 36 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mats} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EAEFF7" />
                  <XAxis type="number" domain={[0, 100]} tick={TICK} unit="%" />
                  <YAxis type="category" dataKey="nome" width={110} tick={TICK} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${v}%`, "Acerto"]} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                    {mats.map((m) => (
                      <Cell key={m.nome} fill={m.pct >= mediaAprovacao * 10 ? OK : AZUL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {materias.some((m) => m.poucas) && <p className="mt-2 text-xs text-ink">* poucas questões (menos de 5): leia com cuidado.</p>}
          </>
        )}
      </Cartao>

      <Cartao titulo="Nota nos simulados" className={css.larga}>
        {simulados.length === 0 ? (
          <Vazio texto={semConta ? "Sem conta de login, não há simulados para mostrar." : "Nenhum simulado entregue ainda."} />
        ) : (
          <div className={`mt-2 h-60 w-full ${css.graficoFixo}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulados} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAEFF7" />
                <XAxis dataKey="data" tick={TICK} interval="preserveStartEnd" padding={{ left: 20, right: 20 }} />
                <YAxis domain={[0, 10]} tick={TICK} width={36} />
                <Tooltip contentStyle={TOOLTIP} labelFormatter={(_, p) => p?.[0]?.payload?.nome ?? ""} formatter={(v) => [String(v).replace(".", ","), "Nota"]} />
                <ReferenceLine y={mediaAprovacao} stroke={DANGER} strokeDasharray="5 4" />
                <Line type="monotone" dataKey="nota" stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>
    </div>
  );
}
