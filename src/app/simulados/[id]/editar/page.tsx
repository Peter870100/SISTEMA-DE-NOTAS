import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarSimulado } from "@/lib/simulados/servidor";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormSimulado } from "@/components/simulados/FormSimulado";
import { MontarQuestoes } from "@/components/simulados/MontarQuestoes";
import { PublicarSimulado } from "@/components/simulados/PublicarSimulado";
import { BookOpen, ClipboardList, Rocket, CheckCircle2 } from "lucide-react";
import base from "@/components/admin/ContasAdmin.module.css";
import css from "@/components/simulados/EditorSimulado.module.css";

export const dynamic = "force-dynamic";

export default async function EditarSimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: simulado } = await supabase.from("simulados").select("*").eq("id", id).maybeSingle();
  if (!simulado || !podeEditarSimulado(professor, simulado)) notFound();

  const [{ data: ligadas, error: e1 }, { data: itens, error: e2 }, { data: assuntos }, { count }, acessiveis] = await Promise.all([
    supabase.from("simulado_turmas").select("turma_nome, ano_letivo").eq("simulado_id", id),
    supabase.from("simulado_questoes").select("questao_id, ordem").eq("simulado_id", id).order("ordem"),
    supabase.from("assuntos").select("id, materia, nome").order("nome"),
    supabase.from("tentativas").select("id", { count: "exact", head: true }).eq("simulado_id", id),
    listarTurmasAcessiveis(),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const ids = (itens ?? []).map((i) => i.questao_id);
  const { data: qs } = ids.length
    ? await supabase.from("questoes").select("id, banca, ano, numero, materia, enunciado").in("id", ids)
    : { data: [] };
  const porId = new Map((qs ?? []).map((q) => [q.id, q]));
  const questoes = ids.flatMap((qid) => {
    const q = porId.get(qid);
    return q ? [{ id: q.id, banca: q.banca, ano: q.ano, numero: q.numero, materia: q.materia, trecho: q.enunciado.replace(/[*]/g, "").slice(0, 160) }] : [];
  });

  const turmasLigadas = ligadas ?? [];
  const opcoes = [...new Map([
    ...acessiveis.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }] as const),
    ...turmasLigadas.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t] as const),
  ]).values()];
  const publicado = simulado.status === "publicado";

  return (
    <PageLayout
      crumb="Simulados"
      titulo={simulado.titulo}
      subtitulo={publicado ? "Publicado" : "Rascunho — os alunos só veem depois de publicar."}
      acoes={publicado ? <Link href={`/simulados/${id}`} className={base.secondary}>Ver resultados</Link> : undefined}
      largura="max-w-6xl"
    >
      <section aria-labelledby="titulo-dados" className={css.card}>
        <div className={css.heading}><span className={css.step}><ClipboardList size={24} aria-hidden="true" /></span><div><h2 id="titulo-dados">Dados do simulado</h2><p>Defina as turmas, os prazos e como a correção será liberada.</p></div></div>
        <FormSimulado
          inicial={{
            id, titulo: simulado.titulo, turmas: turmasLigadas, duracaoMin: simulado.duracao_min ?? 90,
            abreEm: simulado.abre_em ?? "", fechaEm: simulado.fecha_em ?? "", correcao: simulado.correcao, embaralhar: simulado.embaralhar,
          }}
          turmas={opcoes}
        />
      </section>
      <section aria-labelledby="titulo-questoes" className={css.card}>
        <div className={css.heading}><span className={css.step}><BookOpen size={24} aria-hidden="true" /></span><div><h2 id="titulo-questoes">Questões do simulado</h2><p>Use os filtros para montar a prova do seu jeito.</p></div><span className={css.count} aria-label={`${questoes.length} questões`}>{questoes.length}</span></div>
        <MontarQuestoes simuladoId={id} questoes={questoes} travado={(count ?? 0) > 0} assuntos={assuntos ?? []} />
      </section>
      <section aria-labelledby="titulo-publicacao" className={css.card}>
        <div className={css.heading}><span className={css.step}><Rocket size={24} aria-hidden="true" /></span><div><h2 id="titulo-publicacao">{publicado ? "Simulado publicado" : "Pronto para publicar?"}</h2><p>{publicado ? "Acompanhe as entregas e os resultados dos alunos." : "Confira os dados e as questões antes de disponibilizar para as turmas."}</p></div></div>
        {publicado ? (
          <p className={css.notice}><CheckCircle2 size={18} aria-hidden="true" />Publicado. <Link href={`/simulados/${id}`} className="font-semibold text-brand">Ver resultados</Link></p>
        ) : (
          <PublicarSimulado simuladoId={id} />
        )}
      </section>
    </PageLayout>
  );
}
