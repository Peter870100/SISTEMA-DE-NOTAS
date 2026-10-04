import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ClipboardCheck } from "lucide-react";
import { getAlunoAtual } from "@/lib/auth";
import { obterEscola } from "@/lib/escolas";
import { entrarEmTurmaComCodigo } from "@/actions/contas-aluno";
import { listarMinhasTurmas } from "@/lib/convites";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ erro?: string; turma?: string; senha?: string }> };

export default async function AlunoInicioPage({ searchParams }: Props) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const [{ erro, turma, senha }, escola, turmas] = await Promise.all([
    searchParams,
    obterEscola(aluno.escola_id),
    listarMinhasTurmas(aluno.id),
  ]);

  return (
    <>
      <div>
        <p className={estilos.rotulo}>{escola.nome}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Olá, {aluno.nome.split(" ")[0]}!</h1>
      </div>

      {senha === "ok" && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">Senha alterada.</p>}
      {turma === "ok" && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">Pronto! Você entrou na turma.</p>}

      <section aria-labelledby="titulo-turmas" className={`${estilos.card} p-5`}>
        <h2 id="titulo-turmas" className="font-semibold text-ink">Minhas turmas</h2>
        {turmas.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Você ainda não está em nenhuma turma. Peça o código ao seu professor.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {turmas.map((t) => (
              <li key={`${t.turma_nome}|${t.ano_letivo}`} className="rounded-control bg-surface-sunken px-3 py-1.5 text-sm text-ink">
                {t.turma_nome} · {t.ano_letivo}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/aluno/cursos" className={`${estilos.card} flex items-start gap-3 p-5 transition hover:border-brand-bright/40`}>
          <BookOpen size={22} className="mt-0.5 text-brand" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-ink">Aulas</h2>
            <p className="mt-1 text-sm text-muted">Videoaulas e materiais dos seus professores.</p>
          </div>
        </Link>
        <Link href="/aluno/simulados" className={`${estilos.card} flex items-start gap-3 p-5 transition hover:border-brand-bright/40`}>
          <ClipboardCheck size={22} className="mt-0.5 text-brand" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-ink">Simulados</h2>
            <p className="mt-1 text-sm text-muted">Simulados da turma e treinos com correção na hora.</p>
          </div>
        </Link>
      </div>

      <section aria-labelledby="titulo-outra-turma" className={`${estilos.card} p-5`}>
        <h2 id="titulo-outra-turma" className="font-semibold text-ink">Entrar em outra turma</h2>
        <p className="mt-1 text-sm text-muted">Mudou de turma ou de ano? Digite o código que o professor passou.</p>
        {erro === "codigo" && <p role="alert" className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">Código inválido. Confira com seu professor.</p>}
        <form action={entrarEmTurmaComCodigo} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="codigo-turma">Código da turma</label>
          <input id="codigo-turma" name="codigo" required placeholder="K7P-4QX" autoCapitalize="characters" className={`${estilos.input} max-w-40 font-mono uppercase tracking-widest`} />
          <button type="submit" className={estilos.botaoPrimario}>Entrar na turma</button>
        </form>
      </section>
    </>
  );
}
