import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { BarraProgresso } from "@/components/aulas/AulaAluno";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoCursosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const resumos = await resumosCursosAluno(aluno);

  return (
    <>
      <div>
        <p className={estilos.rotulo}>Aulas</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Seus cursos</h1>
      </div>
      {resumos.length === 0 ? (
        <p className={`${estilos.card} p-5 text-sm text-muted`}>Ainda não há cursos para as suas turmas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumos.map(({ curso, professor_nome, porcentagem, continuar }) => (
            <li key={curso.id} className={`${estilos.card} flex flex-col gap-2 p-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/aluno/cursos/${curso.id}`} className="font-semibold text-ink hover:text-brand hover:underline">{curso.titulo}</Link>
                <span className="text-sm font-semibold text-ink">{porcentagem}%</span>
              </div>
              <p className="text-xs text-muted">{curso.disciplina}{professor_nome ? ` · prof. ${professor_nome}` : ""}</p>
              <BarraProgresso porcentagem={porcentagem} rotulo={`Progresso em ${curso.titulo}`} />
              {continuar && <Link href={`/aluno/aulas/${continuar.aula_id}`} className="w-fit text-sm font-semibold text-brand hover:underline">Continuar: {continuar.titulo} →</Link>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
