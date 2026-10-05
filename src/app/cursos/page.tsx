import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { supabase } from "@/lib/supabase/client";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormCurso } from "@/components/cursos/FormCurso";
import { CartaoCurso } from "@/components/cursos/CartaoCurso";
import { estilos } from "@/components/ui/estilos";
export const dynamic = "force-dynamic";
export default async function CursosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  let consulta = supabase.from("cursos").select("*").eq("escola_id", professor.escola_id).order("titulo");
  if (!ehAdmin(professor.role)) consulta = consulta.eq("professor_id", professor.id);
  const [{ data: cursos, error }, turmas, { data: professores }] = await Promise.all([
    consulta, listarTurmasAcessiveis(), supabase.from("professores").select("id, nome").eq("escola_id", professor.escola_id),
  ]);
  if (error) throw new Error(error.message);
  const nomes = new Map((professores ?? []).map((p) => [p.id, p.nome]));
  const opcoes = [...new Map(turmas.map((t) => [t.nome + "|" + t.ano_letivo, { turma_nome: t.nome, ano_letivo: t.ano_letivo }])).values()];
  const contagens = new Map(await Promise.all((cursos ?? []).map(async (c) => {
    const [m, a] = await Promise.all([
      supabase.from("modulos").select("id", { count: "exact", head: true }).eq("curso_id", c.id),
      supabase.from("aulas").select("id", { count: "exact", head: true }).eq("curso_id", c.id),
    ]);
    if (m.error || a.error) throw new Error(m.error?.message ?? a.error?.message);
    return [c.id, { modulos: m.count ?? 0, aulas: a.count ?? 0 }] as const;
  })));
  return <PageLayout crumb="Aulas" titulo="Seus cursos" subtitulo="Monte módulos e aulas com vídeo e material para as suas turmas." largura="max-w-6xl">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="titulo-lista" className="min-w-0">
        <h2 id="titulo-lista" className="sr-only">Cursos</h2>
        {(cursos ?? []).length === 0 ? <p className={estilos.card + " flex items-center gap-2 p-6 text-sm text-muted"}><BookOpen size={16} aria-hidden="true" /> Nenhum curso ainda. Crie seu primeiro curso.</p> :
          <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
            {(cursos ?? []).map((c) => <li key={c.id} className="min-w-0"><CartaoCurso curso={c} href={"/cursos/" + c.id} professorNome={ehAdmin(professor.role) && c.professor_id ? nomes.get(c.professor_id) : null} modulos={contagens.get(c.id)?.modulos} aulas={contagens.get(c.id)?.aulas} /></li>)}
          </ul>}
      </section>
      <section aria-labelledby="titulo-novo" className={estilos.card + " p-4"}>
        <h2 id="titulo-novo" className="mb-3 font-semibold text-ink">Novo curso</h2>
        <FormCurso turmas={opcoes} />
      </section>
    </div>
  </PageLayout>;
}
