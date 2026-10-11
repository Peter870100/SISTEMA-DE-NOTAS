import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { BookOpen } from "lucide-react";
import { CartaoCursoAluno } from "@/components/cursos/CartaoCursoAluno";
import css from "./CursosAluno.module.css";
import { estilos } from "@/components/ui/estilos";
export const dynamic = "force-dynamic";
export default async function AlunoCursosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const resumos = await resumosCursosAluno(aluno);
  return <>
    <div className={css.cabecalho}>
      <div>
        <p className={css.rotulo}>Aulas e conhecimento</p>
        <h1 className="mt-1">Seus cursos</h1>
        <p className={css.descricao}>Continue seus estudos e acompanhe cada etapa.</p>
      </div>
      {resumos.length > 0 && <span className={css.quantidade}><BookOpen size={19} aria-hidden="true" />{resumos.length} {resumos.length === 1 ? "curso disponível" : "cursos disponíveis"}</span>}
    </div>
    {resumos.length === 0 ? <p className={estilos.card + " p-5 text-sm text-ink"}>Ainda não há cursos para as suas turmas.</p> :
      <ul className={css.lista}>
        {resumos.map((resumo) => <li key={resumo.curso.id}><CartaoCursoAluno resumo={resumo} /></li>)}
      </ul>}
  </>;
}
