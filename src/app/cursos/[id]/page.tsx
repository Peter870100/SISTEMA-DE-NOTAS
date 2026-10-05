import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { EstruturaCurso } from "@/components/cursos/EstruturaCurso";
import { EditarCursoBotao } from "@/components/cursos/EditarCursoBotao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function CursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) notFound();

  const [modulos, { data: vinculos, error: erroVinculos }, turmas] = await Promise.all([
    arvoreDoCurso(id, false),
    supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", id),
    listarTurmasAcessiveis(),
  ]);
  if (erroVinculos) throw new Error(erroVinculos.message);
  const turmasCurso = vinculos ?? [];
  const opcoes = [...new Map([
    ...turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }] as const),
    ...turmasCurso.map((t) => [`${t.turma_nome}|${t.ano_letivo}`, t] as const),
  ]).values()];

  return (
    <PageLayout
      crumb={`Aulas · ${curso.disciplina}`}
      titulo={curso.titulo}
      subtitulo={turmasCurso.length ? `Turmas: ${turmasCurso.map((t) => `${t.turma_nome} · ${t.ano_letivo}`).join(", ")}` : "Nenhuma turma vinculada — os alunos ainda não veem este curso."}
      acoes={
        <>
          <EditarCursoBotao inicial={{ id: curso.id, titulo: curso.titulo, disciplina: curso.disciplina, descricao: curso.descricao ?? "", capa_caminho: curso.capa_caminho ?? null, turmas: turmasCurso }} turmas={opcoes} />
          <Link href={`/cursos/${id}/progresso`} className={estilos.botaoSecundario}><BarChart3 size={16} aria-hidden="true" /> Progresso da turma</Link>
        </>
      }
      largura="max-w-4xl"
    >
      <EstruturaCurso cursoId={id} modulos={modulos} />
    </PageLayout>
  );
}
