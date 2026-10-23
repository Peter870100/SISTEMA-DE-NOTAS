"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AcertoMateria, FaixaDistribuicao, MediaBimestreTurma } from "@/lib/relatorios/tipos";
import css from "./Relatorio.module.css";

const AZUL = "#0444A0";
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

type Props = {
  mediaPorBimestre: MediaBimestreTurma[];
  distribuicao: FaixaDistribuicao[];
  materias: AcertoMateria[];
  mediaAprovacao: number;
};

export function GraficosTurma({ mediaPorBimestre, distribuicao, materias, mediaAprovacao }: Props) {
  const bimestres = mediaPorBimestre.map((b) => ({ nome: b.bimestre, media: b.media === null ? null : Number(b.media.toFixed(1)) }));
  const temBimestres = bimestres.some((b) => b.media !== null);
  const temDistribuicao = distribuicao.some((d) => d.quantidade > 0);
  const mats = materias.map((m) => ({ nome: m.rotulo + (m.poucas ? " *" : ""), pct: Math.round(m.pct) }));
  const rotuloMedia = `Média ${String(mediaAprovacao).replace(".", ",")}`;

  return (
    <div className={css.grade}>
      <Cartao titulo="Média por bimestre">
        {!temBimestres ? (
          <Vazio texto="Ainda não há notas lançadas nesta turma." />
        ) : (
          <div className={`mt-2 h-60 w-full ${css.graficoFixo}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bimestres} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAEFF7" />
                <XAxis dataKey="nome" tick={TICK} />
                <YAxis domain={[0, 10]} tick={TICK} width={36} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => [String(v).replace(".", ","), "Média"]} />
                <ReferenceLine y={mediaAprovacao} stroke={DANGER} strokeDasharray="5 4" label={{ value: rotuloMedia, position: "insideTopRight", fill: DANGER, fontSize: 12 }} />
                <Bar dataKey="media" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Distribuição das médias">
        {!temDistribuicao ? (
          <Vazio texto="Nenhum aluno com média calculada ainda." />
        ) : (
          <div className={`mt-2 h-60 w-full ${css.graficoFixo}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribuicao} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAEFF7" />
                <XAxis dataKey="faixa" tick={TICK} />
                <YAxis allowDecimals={false} tick={TICK} width={36} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => [String(v), "Alunos"]} />
                <Bar dataKey="quantidade" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Acerto por matéria (as mais fracas)" className={css.larga}>
        {mats.length === 0 ? (
          <Vazio texto="Ainda não há simulados ou treinos entregues para calcular o acerto por matéria." />
        ) : (
          <>
            <div className={`mt-2 w-full ${css.graficoFixo}`} style={{ height: Math.max(160, mats.length * 40 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mats} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EAEFF7" />
                  <XAxis type="number" domain={[0, 100]} tick={TICK} unit="%" />
                  <YAxis type="category" dataKey="nome" width={120} tick={TICK} />
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
    </div>
  );
}
