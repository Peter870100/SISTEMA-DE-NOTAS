import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { fecharVencidas, podeEditarSimulado } from "@/lib/simulados/servidor";
import { emBlocos, formatarDuracao, situacaoSimulado, tempoDeProvaSeg } from "@/lib/simulados/regras";
import { AREAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { PageLayout } from "@/components/layout/PageLayout";
import { LiberarCorrecao } from "@/components/simulados/LiberarCorrecao";
import { estilos } from "@/components/ui/estilos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { ExternalLink, Hourglass, Send, Target, TriangleAlert, Users, UsersRound, Clock3 } from "lucide-react";
import css from "./ResultadosSimulado.module.css";

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
  const nomes = new Map<string, string>();
  for (const bloco of emBlocos(contaIds, 150)) {
    const { data: contas, error: erroContas } = await supabase.from("alunos_contas").select("id, nome").in("id", bloco);
    if (erroContas) throw new Error(erroContas.message);
    for (const c of contas ?? []) nomes.set(c.id, c.nome);
  }

  const entregueIds = entregues.map((t) => t.id);
  const respostas: { tentativa_id: string; questao_id: string; alternativa: string | null; correta: boolean | null }[] = [];
  for (const bloco of emBlocos(entregueIds, 150)) {
    for (let de = 0; ; de += 1000) {
      const { data, error: erroResp } = await supabase
        .from("tentativa_respostas").select("tentativa_id, questao_id, alternativa, correta").in("tentativa_id", bloco)
        .order("tentativa_id").order("questao_id").range(de, de + 999);
      if (erroResp) throw new Error(erroResp.message);
      respostas.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }
  const agg = new Map<string, { total: number; certas: number; marcadas: Map<string, number> }>();
  for (const r of respostas) {
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
  // Tempo por questão: ordem do caderno do professor; média só entre quem tem o tempo registrado.
  const { data: ordemQs } = await supabase.from("simulado_questoes").select("questao_id").eq("simulado_id", id).order("ordem");
  const colunas = (ordemQs ?? []).map((q) => q.questao_id);
  const acertou = new Map(respostas.map((r) => [`${r.tentativa_id}|${r.questao_id}`, r.correta]));
  const mediaTempo = new Map<string, number>();
  for (const qid of colunas) {
    const v = entregues.map((t) => t.tempo_questoes?.[qid]).filter((s): s is number => typeof s === "number");
    if (v.length) mediaTempo.set(qid, Math.round(v.reduce((a, b) => a + b, 0) / v.length));
  }
  const comTempo = entregues.filter((t) => t.tempo_questoes && Object.keys(t.tempo_questoes).length);

  const ids = piores.map((p) => p.questaoId);
  const { data: qs } = ids.length ? await supabase.from("questoes").select("id, banca, ano, numero, materia").in("id", ids) : { data: [] };
  const qPorId = new Map((qs ?? []).map((q) => [q.id, q]));

  const agora = new Date();
  const situacao = situacaoSimulado(simulado, agora);
  const prazoPassou = simulado.fecha_em ? new Date(simulado.fecha_em) <= agora : false;
  const podeLiberar = simulado.status === "publicado" && simulado.correcao === "apos_prazo" && !prazoPassou;
  const rascunhoOuSemTentativas = simulado.status === "rascunho" || todas.length === 0;
  const linhas = [...todas].sort((a, b) => (nomes.get(a.conta_id) ?? "").localeCompare(nomes.get(b.conta_id) ?? "", "pt-BR"));
  const areas = Object.keys(AREAS) as Area[];

  const notas = entregues.map((t) => t.porcentagem).filter((p): p is number => p != null).map(Number);
  const mediaTurma = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const tempos = entregues.map((t) => tempoDeProvaSeg("professor", t)).filter((s): s is number => s != null);
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
  const painel: ItemResumo[] = [
    { rotulo: "Começaram", valor: String(todas.length), detalhe: "alunos que abriram a prova", Icone: Users },
    { rotulo: "Entregaram", valor: String(entregues.length), detalhe: `${todas.length - entregues.length} ainda em andamento`, Icone: Send },
    { rotulo: "Média da turma", valor: mediaTurma == null ? "—" : `${fmt(mediaTurma)}%`, detalhe: "de acerto nas entregas", Icone: Target },
    { rotulo: "Tempo médio", valor: tempoMedio == null ? "—" : formatarDuracao(tempoMedio), detalhe: "para finalizar a prova", Icone: Hourglass },
  ];
  // Faixa da nota: verde a partir de 70%, dourado de 50% a 69%, vermelho abaixo.
  const faixa = (pct: number) => (pct >= 70 ? "boa" : pct >= 50 ? "media" : "baixa");

  return (
    <PageLayout
      crumb="Simulados"
      titulo={simulado.titulo}
      subtitulo={`${situacao[0].toUpperCase()}${situacao.slice(1)} · ${todas.length} começaram · ${entregues.length} entregaram`}
      acoes={rascunhoOuSemTentativas ? <Link href={`/simulados/${id}/editar`} className={estilos.botaoSecundario}>Editar</Link> : undefined}
      largura="max-w-6xl"
    >
      <PainelResumo itens={painel} />
      {podeLiberar && (
        <section className={`${css.cartao} ${css.liberar}`}>
          <p>A correção só aparece para os alunos depois do prazo.</p>
          <LiberarCorrecao simuladoId={id} emAndamento={todas.length - entregues.length} />
        </section>
      )}
      <section aria-labelledby="titulo-alunos" className={css.cartao}>
        <h2 id="titulo-alunos" className={css.titulo}><span className={css.icone} aria-hidden="true"><UsersRound size={20} /></span>Alunos<span className={css.contador}>{linhas.length}</span></h2>
        {linhas.length === 0 ? <p className={css.vazio}>Ninguém começou ainda.</p> : (
          <div className={css.rolagem}>
            <table className={css.tabela}>
              <thead>
                <tr>
                  <th>Aluno</th><th>Acertos</th><th>%</th>
                  {areas.map((a) => <th key={a}>{AREAS[a]}</th>)}
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((t) => {
                  const feita = t.status === "entregue";
                  const tempo = feita ? tempoDeProvaSeg("professor", t) : null;
                  const pct = feita && t.porcentagem != null ? Number(t.porcentagem) : null;
                  return (
                    <tr key={t.id}>
                      <td className={css.nome}>{nomes.get(t.conta_id) ?? "—"}</td>
                      <td>{feita ? <strong>{t.acertos ?? 0}/{t.total ?? 0}</strong> : <span className={css.andamento}>Em andamento</span>}</td>
                      <td>{pct != null ? <span className={css.nota} data-faixa={faixa(pct)}>{fmt(pct)}%</span> : "—"}</td>
                      {areas.map((a) => { const p = t.por_area?.[a]; return <td key={a}>{feita && p ? `${p.acertos}/${p.total}` : "—"}</td>; })}
                      <td className={css.num}>{tempo != null ? formatarDuracao(tempo) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {comTempo.length > 0 && (
        <section aria-labelledby="titulo-tempos" className={css.cartao}>
          <h2 id="titulo-tempos" className={css.titulo}><span className={css.icone} aria-hidden="true"><Clock3 size={20} /></span>Tempo por questão</h2>
          <p className={css.legenda}>Quanto tempo cada aluno ficou em cada questão (numeração do seu caderno). <span className={css.chipOk}>verde = acertou</span> <span className={css.chipErro}>vermelho = errou</span></p>
          <div className={css.rolagem}>
            <table className={`${css.tabela} ${css.tempos}`}>
              <thead>
                <tr>
                  <th className={css.fixa}>Aluno</th>
                  {colunas.map((qid, i) => <th key={qid}>{String(i + 1).padStart(2, "0")}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...comTempo].sort((a, b) => (nomes.get(a.conta_id) ?? "").localeCompare(nomes.get(b.conta_id) ?? "", "pt-BR")).map((t) => (
                  <tr key={t.id}>
                    <td className={`${css.fixa} ${css.nome}`}>{nomes.get(t.conta_id) ?? "—"}</td>
                    {colunas.map((qid) => {
                      const s = t.tempo_questoes?.[qid];
                      const c = acertou.get(`${t.id}|${qid}`);
                      return <td key={qid} data-resultado={c === true ? "certa" : c === false ? "errada" : undefined}>{s != null ? formatarDuracao(s) : "—"}</td>;
                    })}
                  </tr>
                ))}
                <tr className={css.media}>
                  <td className={css.fixa}>Média</td>
                  {colunas.map((qid) => <td key={qid}>{mediaTempo.has(qid) ? formatarDuracao(mediaTempo.get(qid)!) : "—"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section aria-labelledby="titulo-erradas" className={css.cartao}>
        <h2 id="titulo-erradas" className={css.titulo}><span className={css.icone} aria-hidden="true"><TriangleAlert size={20} /></span>Questões mais erradas</h2>
        {piores.length === 0 ? <p className={css.vazio}>Sem entregas ainda.</p> : (
          <ul className={css.erradas}>
            {piores.map((p) => {
              const q = qPorId.get(p.questaoId);
              return (
                <li key={p.questaoId} className="cartao-interativo">
                  <div className={css.erradaTopo}>
                    <span className={css.erradaNome}>{q ? `${q.banca} ${q.ano ?? ""} · Nº ${q.numero ?? "—"}` : "Questão"}</span>
                    <span className={css.nota} data-faixa={faixa(p.pct)}>{fmt(p.pct)}%</span>
                  </div>
                  <span className={css.barra} role="progressbar" aria-label="Acerto" aria-valuenow={Math.round(p.pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${p.pct}%` }} data-faixa={faixa(p.pct)} /></span>
                  <div className={css.erradaRodape}>
                    <span>Mais marcada: <b className={css.selo}>{p.maisMarcada}</b></span>
                    {mediaTempo.has(p.questaoId) && <span><Clock3 size={15} aria-hidden="true" />{formatarDuracao(mediaTempo.get(p.questaoId)!)} em média</span>}
                    <Link href={`/banco/questoes/${p.questaoId}`} target="_blank" className={css.ver}>Ver questão<ExternalLink size={15} aria-hidden="true" /></Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
