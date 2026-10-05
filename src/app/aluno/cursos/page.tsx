import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { CartaoCurso } from "@/components/cursos/CartaoCurso";
import { estilos } from "@/components/ui/estilos";
export const dynamic = "force-dynamic";
export default async function AlunoCursosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const resumos = await resumosCursosAluno(aluno);
  return <>
    <div><p className={estilos.rotulo}>Aulas</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Seus cursos</h1></div>
    {resumos.length === 0 ? <p className={estilos.card + " p-5 text-sm text-muted"}>Ainda não há cursos para as suas turmas.</p> :
      <ul className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {resumos.map(({ curso, professor_nome, porcentagem, continuar, qtd_modulos, qtd_aulas }) => <li key={curso.id} className="min-w-0">
          <CartaoCurso curso={curso} href={"/aluno/cursos/" + curso.id} professorNome={professor_nome} porcentagem={porcentagem} modulos={qtd_modulos} aulas={qtd_aulas} />
          {continuar && <Link href={"/aluno/aulas/" + continuar.aula_id} className="mt-2 block truncate text-xs font-semibold text-brand hover:underline" title={"Continuar: " + continuar.titulo}>Continuar: {continuar.titulo} →</Link>}
        </li>)}
      </ul>}
  </>;
}
