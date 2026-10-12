import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuizAula } from "@/components/cursos/EditorQuizAula";
import { quizDoProfessor } from "@/lib/aulas/quiz-consultas";
import { iaDisponivel } from "@/lib/questoes/ia";
import { EditorAula } from "@/components/cursos/EditorAula";
import { ArquivosAula } from "@/components/cursos/ArquivosAula";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function EditarAulaPage({ params }: { params: Promise<{ id: string; aulaId: string }> }) {
  const { id, aulaId } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const [{ data: curso }, { data: aula }] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", id).maybeSingle(),
    supabase.from("aulas").select("*").eq("id", aulaId).eq("curso_id", id).maybeSingle(),
  ]);
  if (!curso || !aula || !podeEditarCurso(professor, curso)) notFound();
  const { data: arquivos } = await supabase.from("aula_arquivos").select("*").eq("aula_id", aulaId).order("created_at");
  const lista = arquivos ?? [];
  const { quiz, avisoQuiz } = await quizDoProfessor(aulaId)
    .then(quiz => ({ quiz, avisoQuiz: "" }))
    .catch(() => ({ quiz: null, avisoQuiz: "O quiz ainda precisa ser ativado pelo administrador. Seus dados da aula continuam disponíveis." }));

  return (
    <PageLayout crumb={`Aulas · ${curso.titulo}`} titulo={aula.titulo} subtitulo={aula.publicada ? "Publicada" : "Rascunho — os alunos ainda não veem"} acoes={<Link href={`/cursos/${id}`} className={estilos.botaoSecundario}>← Voltar ao curso</Link>} largura="max-w-4xl">
      <section aria-label="Dados da aula" className={`${estilos.card} p-4`}>
        <EditorAula aula={aula} temArquivos={lista.length > 0} />
      </section>
      <EditorQuizAula aulaId={aulaId} inicial={quiz} iaDisponivel={iaDisponivel()} avisoInicial={avisoQuiz} />
      <section aria-labelledby="titulo-material" className={`${estilos.card} p-4`}>
        <h2 id="titulo-material" className="mb-2 font-semibold text-ink">Material</h2>
        <ArquivosAula aulaId={aulaId} tipo="material" arquivos={lista.filter((a) => a.tipo === "material")} />
      </section>
      <section aria-labelledby="titulo-gabarito" className={`${estilos.card} p-4`}>
        <h2 id="titulo-gabarito" className="mb-2 font-semibold text-ink">Gabarito</h2>
        <ArquivosAula aulaId={aulaId} tipo="gabarito" arquivos={lista.filter((a) => a.tipo === "gabarito")} />
      </section>
    </PageLayout>
  );
}
