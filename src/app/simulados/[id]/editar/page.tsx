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
import { estilos } from "@/components/ui/estilos";

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
      acoes={publicado ? <Link href={`/simulados/${id}`} className={estilos.botaoSecundario}>Ver resultados</Link> : undefined}
      largura="max-w-4xl"
    >
      <section aria-labelledby="titulo-dados" className={`${estilos.card} p-4`}>
        <h2 id="titulo-dados" className="mb-3 font-semibold text-ink">Dados</h2>
        <FormSimulado
          inicial={{
            id, titulo: simulado.titulo, turmas: turmasLigadas, duracaoMin: simulado.duracao_min ?? 90,
            abreEm: simulado.abre_em ?? "", fechaEm: simulado.fecha_em ?? "", correcao: simulado.correcao, embaralhar: simulado.embaralhar,
          }}
          turmas={opcoes}
        />
      </section>
      <section aria-labelledby="titulo-questoes" className={`${estilos.card} p-4`}>
        <h2 id="titulo-questoes" className="mb-3 font-semibold text-ink">Questões ({questoes.length})</h2>
        <MontarQuestoes simuladoId={id} questoes={questoes} travado={(count ?? 0) > 0} assuntos={assuntos ?? []} />
      </section>
      <section className={`${estilos.card} p-4`}>
        {publicado ? (
          <p className="text-sm text-ink">Publicado. <Link href={`/simulados/${id}`} className="font-semibold text-brand">Ver resultados</Link></p>
        ) : (
          <PublicarSimulado simuladoId={id} />
        )}
      </section>
    </PageLayout>
  );
}
