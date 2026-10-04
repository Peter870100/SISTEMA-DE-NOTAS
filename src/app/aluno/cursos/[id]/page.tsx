import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { cursoVisivelParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso, progressoDoAluno } from "@/lib/aulas/consultas";
import { estadoAula, porcentagemAula, porcentagemConjunto } from "@/lib/aulas/progresso";
import { BarraProgresso } from "@/components/aulas/AulaAluno";
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
  const total = porcentagemConjunto(todas.filter((a) => progresso.get(a.id)?.concluida_em).length, todas.length);

  return (
    <>
      <div>
        <Link href="/aluno/cursos" className="text-sm text-brand hover:underline">← Seus cursos</Link>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{curso.titulo}</h1>
        {curso.descricao && <p className="mt-1 text-sm text-muted">{curso.descricao}</p>}
        <div className="mt-3 flex items-center gap-3"><div className="flex-1"><BarraProgresso porcentagem={total} rotulo="Progresso no curso" /></div><span className="text-sm font-semibold text-ink">{total}%</span></div>
      </div>
      {modulos.filter((m) => m.aulas.length > 0).map((m) => {
        const pct = porcentagemConjunto(m.aulas.filter((a) => progresso.get(a.id)?.concluida_em).length, m.aulas.length);
        return (
          <section key={m.id} aria-label={m.titulo} className={`${estilos.card} p-4`}>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-ink">{m.titulo}</h2>
              <div className="flex-1"><BarraProgresso porcentagem={pct} rotulo={`Progresso em ${m.titulo}`} /></div>
              <span className="text-sm font-semibold text-ink">{pct}%</span>
            </div>
            <ol className="mt-2 divide-y divide-line">
              {m.aulas.map((a, i) => {
                const p = progresso.get(a.id) ?? null;
                const estado = estadoAula(p);
                const texto = estado === "concluida" ? "Concluída" : estado === "andamento" ? `Não concluída · ${porcentagemAula(p)}% assistido` : "Não iniciada";
                const icone = estado === "concluida" ? "✓" : estado === "andamento" ? "◐" : "○";
                return (
                  <li key={a.id}>
                    <Link href={`/aluno/aulas/${a.id}`} className="flex items-center gap-3 rounded-control px-1 py-2 text-sm hover:bg-surface-sunken">
                      <span aria-hidden="true" className={estado === "concluida" ? "text-ok" : "text-muted"}>{icone}</span>
                      <span className="flex-1 text-ink">{i + 1}. {a.titulo}</span>
                      <span className={`text-xs ${estado === "concluida" ? "text-ok" : "text-muted"}`}>{texto}</span>
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
