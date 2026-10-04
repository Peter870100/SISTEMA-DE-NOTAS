import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { fecharVencidas, podeEditarSimulado } from "@/lib/simulados/servidor";
import { situacaoSimulado } from "@/lib/simulados/regras";
import { AREAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { PageLayout } from "@/components/layout/PageLayout";
import { LiberarCorrecao } from "@/components/simulados/LiberarCorrecao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ResultadosSimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: simulado } = await supabase.from("simulados").select("*").eq("id", id).maybeSingle();
  if (!simulado || !podeEditarSimulado(professor, simulado)) notFound();

  await fecharVencidas(id);
  const { data: tentativas, error } = await supabase.from("tentativas").select("*").eq("simulado_id", id);
  if (error) throw new Error(error.message);
  const todas = tentativas ?? [];
  const entregues = todas.filter((t) => t.status === "entregue");

  const contaIds = todas.map((t) => t.conta_id);
  const { data: contas } = contaIds.length ? await supabase.from("alunos_contas").select("id, nome").in("id", contaIds) : { data: [] };
  const nomes = new Map((contas ?? []).map((c) => [c.id, c.nome]));

  const entregueIds = entregues.map((t) => t.id);
  const { data: respostas } = entregueIds.length
    ? await supabase.from("tentativa_respostas").select("questao_id, alternativa, correta").in("tentativa_id", entregueIds)
    : { data: [] };
  const agg = new Map<string, { total: number; certas: number; marcadas: Map<string, number> }>();
  for (const r of respostas ?? []) {
    const a = agg.get(r.questao_id) ?? { total: 0, certas: 0, marcadas: new Map() };
    a.total++;
    if (r.correta) a.certas++;
    if (r.alternativa) a.marcadas.set(r.alternativa, (a.marcadas.get(r.alternativa) ?? 0) + 1);
    agg.set(r.questao_id, a);
  }
  const piores = [...agg.entries()]
    .map(([questaoId, a]) => ({
      questaoId, pct: (a.certas / a.total) * 100,
      maisMarcada: [...a.marcadas.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "—",
    }))
    .sort((x, y) => x.pct - y.pct)
    .slice(0, 10);
  const ids = piores.map((p) => p.questaoId);
  const { data: qs } = ids.length ? await supabase.from("questoes").select("id, banca, ano, numero, materia").in("id", ids) : { data: [] };
  const qPorId = new Map((qs ?? []).map((q) => [q.id, q]));

  const agora = new Date();
  const situacao = situacaoSimulado(simulado, agora);
  const prazoPassou = simulado.fecha_em ? new Date(simulado.fecha_em) <= agora : false;
  const podeLiberar = simulado.correcao === "apos_prazo" && !prazoPassou;
  const rascunhoOuSemTentativas = simulado.status === "rascunho" || todas.length === 0;
  const linhas = [...todas].sort((a, b) => (nomes.get(a.conta_id) ?? "").localeCompare(nomes.get(b.conta_id) ?? "", "pt-BR"));
  const areas = Object.keys(AREAS) as Area[];

  return (
    <PageLayout
      crumb="Simulados"
      titulo={simulado.titulo}
      subtitulo={`${situacao[0].toUpperCase()}${situacao.slice(1)} · ${todas.length} começaram · ${entregues.length} entregaram`}
      acoes={rascunhoOuSemTentativas ? <Link href={`/simulados/${id}/editar`} className={estilos.botaoSecundario}>Editar</Link> : undefined}
      largura="max-w-6xl"
    >
      {podeLiberar && (
        <section className={`${estilos.card} p-4`}>
          <p className="mb-2 text-sm text-muted">A correção só aparece para os alunos depois do prazo.</p>
          <LiberarCorrecao simuladoId={id} />
        </section>
      )}
      <section aria-labelledby="titulo-alunos" className={`${estilos.card} overflow-x-auto p-4`}>
        <h2 id="titulo-alunos" className="mb-3 font-semibold text-ink">Alunos</h2>
        {linhas.length === 0 ? <p className="text-sm text-muted">Ninguém começou ainda.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-3">Aluno</th><th className="pr-3">Acertos</th><th className="pr-3">%</th>
                {areas.map((a) => <th key={a} className="pr-3">{AREAS[a]}</th>)}
                <th>Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((t) => {
                const feita = t.status === "entregue";
                const min = feita && t.entregue_em ? Math.round((Date.parse(t.entregue_em) - Date.parse(t.iniciada_em)) / 60000) : null;
                return (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-medium text-ink">{nomes.get(t.conta_id) ?? "—"}</td>
                    <td className="pr-3">{feita ? `${t.acertos ?? 0}/${t.total ?? 0}` : "Em andamento"}</td>
                    <td className="pr-3">{feita && t.porcentagem != null ? `${fmt(Number(t.porcentagem))}%` : "—"}</td>
                    {areas.map((a) => { const p = t.por_area?.[a]; return <td key={a} className="pr-3">{feita && p ? `${p.acertos}/${p.total}` : "—"}</td>; })}
                    <td>{min != null ? `${min} min` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="titulo-erradas" className={`${estilos.card} p-4`}>
        <h2 id="titulo-erradas" className="mb-3 font-semibold text-ink">Questões mais erradas</h2>
        {piores.length === 0 ? <p className="text-sm text-muted">Sem entregas ainda.</p> : (
          <ul className="divide-y divide-line">
            {piores.map((p) => {
              const q = qPorId.get(p.questaoId);
              return (
                <li key={p.questaoId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-ink">{q ? `${q.banca} ${q.ano ?? ""} · Nº ${q.numero ?? "—"}` : "Questão"}</span>
                  <span className="text-muted">{fmt(p.pct)}% de acerto · mais marcada: {p.maisMarcada}</span>
                  <Link href={`/banco/questoes/${p.questaoId}`} target="_blank" className={estilos.botaoFantasma}>Ver</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
