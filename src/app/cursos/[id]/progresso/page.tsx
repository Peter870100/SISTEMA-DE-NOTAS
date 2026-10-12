import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarCurso } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { porcentagemConjunto } from "@/lib/aulas/progresso";
import { formatarDuracao } from "@/lib/simulados/regras";
import { formatarPresenca } from "@/lib/hermes/presenca";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { CircleOff, Gauge, PlayCircle, Trophy, Users, UsersRound } from "lucide-react";
import ui from "@/components/ui/SecaoPainel.module.css";

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
    contaIds.length ? supabase.from("aula_progresso").select("conta_id, aula_id, maior_posicao_seg, duracao_seg, tempo_assistido_seg, saidas, tempo_fora_seg, concluida_em").eq("curso_id", id).in("conta_id", contaIds) : Promise.resolve({ data: [] as { conta_id: string; aula_id: string; maior_posicao_seg: number; duracao_seg: number | null; tempo_assistido_seg: number; saidas: number; tempo_fora_seg: number; concluida_em: string | null }[] }),
  ]);
  const concluidas = new Set((progressos ?? []).filter((p) => p.concluida_em).map((p) => `${p.conta_id}|${p.aula_id}`));
  const fez = (contaId: string, lista: { id: string }[]) => lista.filter((a) => concluidas.has(`${contaId}|${a.id}`)).length;
  const porAula = aulas.map((a) => ({ aula: a, alunos: (contas ?? []).filter((c) => concluidas.has(`${c.id}|${a.id}`)).length })).sort((x, y) => x.alunos - y.alunos);

  const somaAluno = new Map<string, { assistido: number; saidas: number; fora: number }>();
  for (const p of progressos ?? []) {
    const t = somaAluno.get(p.conta_id) ?? { assistido: 0, saidas: 0, fora: 0 };
    t.assistido += p.tempo_assistido_seg ?? 0;
    t.saidas += p.saidas ?? 0;
    t.fora += p.tempo_fora_seg ?? 0;
    somaAluno.set(p.conta_id, t);
  }

  const alunos = contas ?? [];
  const pctAluno = new Map(alunos.map((c) => [c.id, porcentagemConjunto(fez(c.id, aulas), aulas.length)]));
  const media = alunos.length ? Math.round([...pctAluno.values()].reduce((x, y) => x + y, 0) / alunos.length) : null;
  const painel: ItemResumo[] = [
    { rotulo: "Alunos", valor: String(alunos.length), detalhe: escolhida ? `${escolhida.turma_nome} · ${escolhida.ano_letivo}` : "sem turma", Icone: Users },
    { rotulo: "Progresso médio", valor: media == null ? "—" : `${media}%`, detalhe: "do curso concluído", Icone: Gauge },
    { rotulo: "Concluíram", valor: String([...pctAluno.values()].filter((p) => p >= 100).length), detalhe: "terminaram todas as aulas", Icone: Trophy },
    { rotulo: "Nunca acessaram", valor: String(alunos.filter((c) => !c.ultimo_acesso).length), detalhe: "ainda sem entrar", Icone: CircleOff },
  ];
  const faixa = (pct: number) => (pct >= 70 ? "boa" : pct >= 40 ? "media" : "baixa");
  const comAulas = modulos.filter((m) => m.aulas.length);

  return (
    <PageLayout crumb={`Aulas · ${curso.titulo}`} titulo="Progresso da turma" acoes={<Link href={`/cursos/${id}`} className={estilos.botaoSecundario}>← Voltar ao curso</Link>} largura="max-w-6xl">
      {opcoes.length === 0 ? (
        <p className={`${ui.cartao} ${ui.vazio}`}>Este curso ainda não está ligado a nenhuma turma.</p>
      ) : (
        <>
          <nav aria-label="Turmas" className="flex flex-wrap gap-2">
            {opcoes.map((o) => (
              <Link key={o.chave} href={`/cursos/${id}/progresso?turma=${encodeURIComponent(o.chave)}`} aria-current={o.chave === escolhida?.chave ? "page" : undefined} className={o.chave === escolhida?.chave ? estilos.botaoPrimario : estilos.botaoSecundario}>{o.turma_nome} · {o.ano_letivo}</Link>
            ))}
          </nav>
          <PainelResumo itens={painel} />
          <section aria-labelledby="titulo-alunos" className={ui.cartao}>
            <h2 id="titulo-alunos" className={ui.titulo}><span className={ui.icone} aria-hidden="true"><UsersRound size={20} /></span>Alunos<span className={ui.contador}>{alunos.length}</span></h2>
            {alunos.length === 0 ? (
              <p className={ui.vazio}>Nenhum aluno com conta nesta turma ainda.</p>
            ) : (
              <div className={ui.rolagem}>
                <table className={ui.tabela}>
                  <thead>
                    <tr><th>Aluno</th><th>Curso</th>{comAulas.map((m) => <th key={m.id}>{m.titulo}</th>)}<th>Assistido</th><th>Saídas</th><th>Último acesso</th></tr>
                  </thead>
                  <tbody>
                    {alunos.map((c) => {
                      const pct = pctAluno.get(c.id) ?? 0;
                      const soma = somaAluno.get(c.id);
                      return (
                        <tr key={c.id}>
                          <td className={ui.nome}>{c.nome}</td>
                          <td><span className={ui.nota} data-faixa={faixa(pct)}>{pct}%</span></td>
                          {comAulas.map((m) => <td key={m.id} className={ui.num}>{porcentagemConjunto(fez(c.id, m.aulas), m.aulas.length)}%</td>)}
                          <td className={ui.num}>{soma ? formatarDuracao(soma.assistido) : "—"}</td>
                          <td>{formatarPresenca(soma ? soma.saidas : null, soma ? soma.fora : null)}</td>
                          <td>{c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : <span className={ui.andamento}>Nunca</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {aulas.length > 0 && alunos.length > 0 && (
            <section aria-labelledby="titulo-aulas" className={ui.cartao}>
              <h2 id="titulo-aulas" className={ui.titulo}><span className={ui.icone} aria-hidden="true"><PlayCircle size={20} /></span>Aulas com menos alunos concluindo</h2>
              <ol className="grid gap-3 lg:grid-cols-2">
                {porAula.map(({ aula, alunos: quantos }) => {
                  const pct = Math.round((100 * quantos) / alunos.length);
                  return (
                    <li key={aula.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-heading text-base font-bold uppercase text-ink">{aula.titulo}</span>
                        <span className={ui.nota} data-faixa={faixa(pct)}>{quantos}/{alunos.length}</span>
                      </div>
                      <span className={ui.barra} role="progressbar" aria-label={`Concluíram ${aula.titulo}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} data-faixa={faixa(pct)} /></span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </PageLayout>
  );
}
