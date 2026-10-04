import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { porcentagemConjunto } from "@/lib/aulas/progresso";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ turma?: string }> };

export default async function ProgressoTurmaPage({ params, searchParams }: Props) {
  const [{ id }, { turma }] = await Promise.all([params, searchParams]);
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
  if (!curso || !podeEditarCurso(professor, curso)) notFound();

  const { data: turmasCurso } = await supabase.from("curso_turmas").select("turma_nome, ano_letivo").eq("curso_id", id);
  const opcoes = (turmasCurso ?? []).map((t) => ({ ...t, chave: `${t.turma_nome}|${t.ano_letivo}` }));
  const escolhida = opcoes.find((o) => o.chave === turma) ?? opcoes[0];

  const modulos = await arvoreDoCurso(id, true);
  const aulas = modulos.flatMap((m) => m.aulas);

  const { data: vinculos } = escolhida
    ? await supabase.from("aluno_turmas").select("conta_id").eq("escola_id", curso.escola_id).eq("turma_nome", escolhida.turma_nome).eq("ano_letivo", escolhida.ano_letivo)
    : { data: [] as { conta_id: string }[] };
  const contaIds = (vinculos ?? []).map((v) => v.conta_id);
  const [{ data: contas }, { data: progressos }] = await Promise.all([
    contaIds.length ? supabase.from("alunos_contas").select("id, nome, ultimo_acesso").in("id", contaIds).order("nome") : Promise.resolve({ data: [] as { id: string; nome: string; ultimo_acesso: string | null }[] }),
    contaIds.length ? supabase.from("aula_progresso").select("conta_id, aula_id, concluida_em").eq("curso_id", id).in("conta_id", contaIds) : Promise.resolve({ data: [] as { conta_id: string; aula_id: string; concluida_em: string | null }[] }),
  ]);
  const concluidas = new Set((progressos ?? []).filter((p) => p.concluida_em).map((p) => `${p.conta_id}|${p.aula_id}`));
  const fez = (contaId: string, lista: { id: string }[]) => lista.filter((a) => concluidas.has(`${contaId}|${a.id}`)).length;
  const porAula = aulas.map((a) => ({ aula: a, alunos: (contas ?? []).filter((c) => concluidas.has(`${c.id}|${a.id}`)).length })).sort((x, y) => x.alunos - y.alunos);

  return (
    <PageLayout crumb={`Aulas · ${curso.titulo}`} titulo="Progresso da turma" acoes={<Link href={`/cursos/${id}`} className={estilos.botaoSecundario}>← Voltar ao curso</Link>} largura="max-w-6xl">
      {opcoes.length === 0 ? (
        <p className={`${estilos.card} p-4 text-sm text-muted`}>Este curso ainda não está ligado a nenhuma turma.</p>
      ) : (
        <>
          <nav aria-label="Turmas" className="flex flex-wrap gap-2">
            {opcoes.map((o) => (
              <Link key={o.chave} href={`/cursos/${id}/progresso?turma=${encodeURIComponent(o.chave)}`} aria-current={o.chave === escolhida?.chave ? "page" : undefined} className={o.chave === escolhida?.chave ? estilos.botaoPrimario : estilos.botaoSecundario}>{o.turma_nome} · {o.ano_letivo}</Link>
            ))}
          </nav>
          <section aria-label="Alunos" className={`${estilos.card} overflow-x-auto p-4`}>
            {(contas ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nenhum aluno com conta nesta turma ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={estilos.rotulo}>
                  <tr><th className="px-2 py-2">Aluno</th><th className="px-2 py-2">Curso</th>{modulos.filter((m) => m.aulas.length).map((m) => <th key={m.id} className="px-2 py-2">{m.titulo}</th>)}<th className="px-2 py-2">Último acesso</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(contas ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-2 py-2 font-medium text-ink">{c.nome}</td>
                      <td className="px-2 py-2 font-mono tabular-nums">{porcentagemConjunto(fez(c.id, aulas), aulas.length)}%</td>
                      {modulos.filter((m) => m.aulas.length).map((m) => <td key={m.id} className="px-2 py-2 font-mono tabular-nums text-muted">{porcentagemConjunto(fez(c.id, m.aulas), m.aulas.length)}%</td>)}
                      <td className="px-2 py-2 text-muted">{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR") : "nunca"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {aulas.length > 0 && (contas ?? []).length > 0 && (
            <section aria-labelledby="titulo-aulas" className={`${estilos.card} p-4`}>
              <h2 id="titulo-aulas" className="mb-2 font-semibold text-ink">Aulas com menos alunos concluindo</h2>
              <ol className="flex flex-col gap-1 text-sm">{porAula.map(({ aula, alunos }) => <li key={aula.id} className="flex justify-between gap-2"><span className="text-ink">{aula.titulo}</span><span className="font-mono tabular-nums text-muted">{alunos}/{(contas ?? []).length}</span></li>)}</ol>
            </section>
          )}
        </>
      )}
    </PageLayout>
  );
}
