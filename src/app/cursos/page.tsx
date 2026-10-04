import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { supabase } from "@/lib/supabase/client";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormCurso } from "@/components/cursos/FormCurso";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function CursosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  let consulta = supabase.from("cursos").select("*").eq("escola_id", professor.escola_id).order("titulo");
  if (!ehAdmin(professor.role)) consulta = consulta.eq("professor_id", professor.id);
  const [{ data: cursos }, turmas, { data: professores }] = await Promise.all([
    consulta,
    listarTurmasAcessiveis(),
    supabase.from("professores").select("id, nome").eq("escola_id", professor.escola_id),
  ]);
  const nomes = new Map((professores ?? []).map((p) => [p.id, p.nome]));
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }])).values()];

  return (
    <PageLayout crumb="Aulas" titulo="Seus cursos" subtitulo="Monte módulos e aulas com vídeo e material para as suas turmas." largura="max-w-6xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="titulo-lista" className={`${estilos.card} p-4`}>
          <h2 id="titulo-lista" className="sr-only">Cursos</h2>
          {(cursos ?? []).length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted"><BookOpen size={16} aria-hidden="true" /> Nenhum curso ainda. Crie o primeiro ao lado.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(cursos ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/cursos/${c.id}`} className="flex items-center justify-between gap-3 rounded-control px-2 py-3 hover:bg-surface-sunken">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{c.titulo}</span>
                      <span className="block text-xs text-muted">{c.disciplina}{ehAdmin(professor.role) && c.professor_id ? ` · ${nomes.get(c.professor_id) ?? ""}` : ""}</span>
                    </span>
                    <span aria-hidden="true" className="text-brand">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="titulo-novo" className={`${estilos.card} p-4`}>
          <h2 id="titulo-novo" className="mb-3 font-semibold text-ink">Novo curso</h2>
          <FormCurso turmas={opcoes} />
        </section>
      </div>
    </PageLayout>
  );
}
