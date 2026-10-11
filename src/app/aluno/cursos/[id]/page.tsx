import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { cursoVisivelParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso, progressoDoAluno } from "@/lib/aulas/consultas";
import { estadoAula, porcentagemAula, porcentagemAssistida } from "@/lib/aulas/progresso";
import { ProgressoCurso } from "@/components/aulas/ProgressoCurso";
import css from "./CursoAluno.module.css";
import { MiniaturaAula } from "@/components/cursos/MiniaturaAula";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const curso = await cursoVisivelParaAluno(aluno, id);
  if (!curso) notFound();
  const [modulos, progresso] = await Promise.all([arvoreDoCurso(id, true), progressoDoAluno(aluno.id, id)]);
  const todas = modulos.flatMap((m) => m.aulas);
  const total = porcentagemAssistida(todas, progresso);

  return (
    <>
      <div>
        <Link href="/aluno/cursos" className={`${css.voltar} text-brand hover:underline`}>← Seus cursos</Link>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{curso.titulo}</h1>
        {curso.descricao && <p className="mt-1 text-sm text-muted">{curso.descricao}</p>}
        <div className={css.progressoGeral}><p className={css.rotulo}>Seu progresso</p><ProgressoCurso porcentagem={total} rotulo="Progresso no curso" /></div>
      </div>
      {modulos.filter((m) => m.aulas.length > 0).map((m) => {
        const pct = porcentagemAssistida(m.aulas, progresso);
        return (
          <section key={m.id} aria-label={m.titulo} className={`${estilos.card} ${css.modulo}`}>
            <div className={css.cabecalhoModulo}>
              <h2 className="font-semibold text-ink">{m.titulo}</h2>
              <div className={css.progressoModulo}><ProgressoCurso porcentagem={pct} rotulo={`Progresso em ${m.titulo}`} /></div>
            </div>
            <ol className="mt-2 divide-y divide-line">
              {m.aulas.map((a, i) => {
                const p = progresso.get(a.id) ?? null;
                const estado = estadoAula(p);
                const texto = estado === "concluida" ? "Concluída" : estado === "andamento" ? `Não concluída · ${porcentagemAula(p)}% assistido` : "Não iniciada";
                const icone = estado === "concluida" ? "✓" : estado === "andamento" ? "◐" : "○";
                return (
                  <li key={a.id}>
                    <Link href={`/aluno/aulas/${a.id}`} className={css.aula}>
                      <MiniaturaAula caminho={a.capa_caminho} videoId={a.video_id} porcentagem={porcentagemAula(p)} />
                      <span aria-hidden="true" className={estado === "concluida" ? "text-ok" : "text-muted"}>{icone}</span>
                      <span className={css.tituloAula}>{i + 1}. {a.titulo}</span>
                      <span className={css.estado} data-concluida={estado === "concluida"} aria-label={texto}>{estado === "andamento" ? <><strong>{porcentagemAula(p)}%</strong> assistido</> : texto}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </>
  );
}
