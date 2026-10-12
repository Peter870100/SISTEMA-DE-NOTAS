import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, ClipboardList, FilePenLine, Plus, Send, Timer, Users } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { supabase } from "@/lib/supabase/client";
import { emBlocos, situacaoSimulado, type Situacao } from "@/lib/simulados/regras";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import css from "./SimuladosProfessor.module.css";

export const dynamic = "force-dynamic";

const ROTULOS: Record<Situacao, string> = { rascunho: "Rascunho", agendado: "Agendado", aberto: "Aberto", encerrado: "Encerrado" };
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export default async function SimuladosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  let consulta = supabase.from("simulados").select("*").eq("escola_id", professor.escola_id).eq("tipo", "professor").order("created_at", { ascending: false });
  if (!ehAdmin(professor.role)) consulta = consulta.eq("professor_id", professor.id);
  const { data: simulados, error } = await consulta;
  if (error) throw new Error(error.message);
  const agora = new Date();

  // Turmas e contagem de alunos por simulado, em lote (sem consulta por item).
  const turmasPorSimulado = new Map<string, string[]>();
  const contagem = new Map<string, { comecaram: number; entregaram: number }>();
  for (const bloco of emBlocos((simulados ?? []).map((s) => s.id), 100)) {
    const { data: alvos, error: eT } = await supabase.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").in("simulado_id", bloco).order("turma_nome");
    if (eT) throw new Error(eT.message);
    for (const a of alvos ?? []) turmasPorSimulado.set(a.simulado_id, [...(turmasPorSimulado.get(a.simulado_id) ?? []), `${a.turma_nome} · ${a.ano_letivo}`]);
    for (let de = 0; ; de += 1000) {
      const { data: tents, error: eN } = await supabase.from("tentativas").select("id, simulado_id, status").in("simulado_id", bloco).order("id").range(de, de + 999);
      if (eN) throw new Error(eN.message);
      for (const t of tents ?? []) {
        const c = contagem.get(t.simulado_id) ?? { comecaram: 0, entregaram: 0 };
        c.comecaram++;
        if (t.status === "entregue") c.entregaram++;
        contagem.set(t.simulado_id, c);
      }
      if ((tents ?? []).length < 1000) break;
    }
  }

  const lista = simulados ?? [];
  const situacoes = new Map(lista.map((s) => [s.id, situacaoSimulado(s, agora)]));
  const entregasTotal = [...contagem.values()].reduce((soma, c) => soma + c.entregaram, 0);
  const painel: ItemResumo[] = [
    { rotulo: "Simulados", valor: String(lista.length), detalhe: "criados até agora", Icone: ClipboardList },
    { rotulo: "Abertos", valor: String(lista.filter((s) => situacoes.get(s.id) === "aberto").length), detalhe: "acontecendo agora", Icone: Timer },
    { rotulo: "Rascunhos", valor: String(lista.filter((s) => situacoes.get(s.id) === "rascunho").length), detalhe: "ainda não publicados", Icone: FilePenLine },
    { rotulo: "Entregas", valor: String(entregasTotal), detalhe: "provas entregues pelos alunos", Icone: Send },
  ];

  return (
    <PageLayout
      crumb="Simulados"
      titulo="Simulados"
      subtitulo="Provas cronometradas com questões do banco, aplicadas às suas turmas."
      acoes={<Link href="/simulados/novo" className={estilos.botaoPrimario}><Plus size={16} aria-hidden="true" /> Novo simulado</Link>}
      largura="max-w-7xl"
    >
      <PainelResumo itens={painel} />
      <section aria-labelledby="titulo-lista" className="flex flex-col gap-3">
        <h2 id="titulo-lista" className={css.tituloSecao}><ClipboardList size={22} aria-hidden="true" />Seus simulados<span>{lista.length}</span></h2>
        {lista.length === 0 ? (
          <p className={css.vazio}><Timer size={18} aria-hidden="true" /> Nenhum simulado ainda. Crie o primeiro em “Novo simulado”.</p>
        ) : (
          <ul className={css.lista}>
            {lista.map((s, i) => {
              const situacao = situacoes.get(s.id)!;
              const c = contagem.get(s.id) ?? { comecaram: 0, entregaram: 0 };
              const pct = c.comecaram ? Math.round((100 * c.entregaram) / c.comecaram) : 0;
              const turmas = turmasPorSimulado.get(s.id) ?? [];
              const publicado = s.status === "publicado";
              return (
                <li key={s.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <Link href={publicado ? `/simulados/${s.id}` : `/simulados/${s.id}/editar`} className={`${css.cartao} cartao-interativo`} data-situacao={situacao}>
                    <div className={css.topo}>
                      <span className={css.icone} data-icone aria-hidden="true"><Timer size={22} strokeWidth={2.2} /></span>
                      <span className={css.etiqueta}>{ROTULOS[situacao]}</span>
                    </div>
                    <h3 className={css.titulo}>{s.titulo}</h3>
                    <ul className={css.meta}>
                      <li><CalendarClock size={16} aria-hidden="true" />{data(s.abre_em)} até {data(s.fecha_em)}</li>
                      <li><Users size={16} aria-hidden="true" />{turmas.join(", ") || "Sem turmas"}</li>
                      {s.duracao_min && <li><Timer size={16} aria-hidden="true" />{s.duracao_min} min</li>}
                    </ul>
                    <div className={css.rodape}>
                      {publicado ? (
                        <div className={css.entregas}>
                          <p><strong>{c.entregaram}</strong>/{c.comecaram} entregaram</p>
                          <span className={css.barra} role="progressbar" aria-label="Entregas" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></span>
                        </div>
                      ) : <p className={css.aviso}>Rascunho — termine de montar e publique.</p>}
                      <span className={css.acao}>{publicado ? "Ver resultados" : "Continuar editando"}<ArrowRight size={17} aria-hidden="true" /></span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
