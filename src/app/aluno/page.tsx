import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Gauge, GraduationCap, KeyRound, ListTodo, Play, Target, Timer, UsersRound } from "lucide-react";
import { getAlunoAtual } from "@/lib/auth";
import { obterEscola } from "@/lib/escolas";
import { entrarEmTurmaComCodigo } from "@/actions/contas-aluno";
import { listarMinhasTurmas } from "@/lib/convites";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { simuladosDoAluno } from "@/lib/simulados/servidor";
import { resumoSimulados, situacaoSimulado } from "@/lib/simulados/regras";
import { PainelResumo, type ItemResumo } from "@/components/aluno/PainelResumo";
import { estilos } from "@/components/ui/estilos";
import css from "./InicioAluno.module.css";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ erro?: string; turma?: string; senha?: string }> };

export default async function AlunoInicioPage({ searchParams }: Props) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const [{ erro, turma, senha }, escola, turmas, cursos, simulados] = await Promise.all([
    searchParams,
    obterEscola(aluno.escola_id),
    listarMinhasTurmas(aluno.id),
    resumosCursosAluno(aluno),
    simuladosDoAluno(aluno),
  ]);

  const agora = new Date();
  const pct = (p: number) => Math.max(0, Math.min(100, Math.round(p)));
  const progressoMedio = cursos.length ? Math.round(cursos.reduce((soma, r) => soma + pct(r.porcentagem), 0) / cursos.length) : null;
  const aulas = cursos.reduce((soma, r) => soma + r.qtd_aulas, 0);
  const aulasFeitas = cursos.reduce((soma, r) => soma + r.qtd_concluidas, 0);
  const sim = resumoSimulados(simulados.daTurma, simulados.treinos, simulados.tentativas, agora);
  const painel: ItemResumo[] = [
    { rotulo: "Progresso nos cursos", valor: progressoMedio == null ? "—" : `${progressoMedio}%`, detalhe: "média de todos os cursos", Icone: Gauge },
    { rotulo: "Aulas concluídas", valor: `${aulasFeitas}/${aulas}`, detalhe: "assistidas até o fim", Icone: CheckCircle2 },
    { rotulo: "Simulados para fazer", valor: String(sim.paraFazer), detalhe: "da sua turma", Icone: ListTodo },
    { rotulo: "Média nos simulados", valor: sim.media == null ? "—" : `${sim.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, detalhe: "nos já corrigidos", Icone: Target },
  ];

  // Próximos passos: curso em andamento (senão o primeiro a começar) e simulado da turma pendente.
  const proximoCurso = cursos.find((r) => r.continuar && pct(r.porcentagem) > 0) ?? cursos.find((r) => r.continuar);
  const proximoSimulado = simulados.daTurma.find((s) => {
    const t = simulados.tentativas.get(s.id);
    return t ? t.status === "em_andamento" : situacaoSimulado(s, agora) === "aberto";
  });

  return (
    <div className={css.pagina} data-largura-total>
      <header className={`${css.cabecalho} cartao-interativo`}>
        <p className={css.rotulo}>{escola.nome}</p>
        <h1 className={css.titulo}><span className={css.icone} data-icone><GraduationCap size={25} strokeWidth={2.2} aria-hidden="true" /></span>Olá, {aluno.nome.split(" ")[0]}!</h1>
      </header>

      {senha === "ok" && <p role="status" className={css.ok}>Senha alterada.</p>}
      {turma === "ok" && <p role="status" className={css.ok}>Pronto! Você entrou na turma.</p>}

      <PainelResumo itens={painel} />

      <div className={css.atalhos}>
        <article className={`${css.atalho} cartao-interativo`} aria-labelledby="atalho-cursos">
          <div className={css.visual}><BookOpen size={44} strokeWidth={1.6} aria-hidden="true" /><span>Aulas</span></div>
          <div className={css.conteudo}>
            <span className={css.etiqueta}>Aulas e conhecimento</span>
            <h2 id="atalho-cursos" className={css.tituloAtalho}>Seus cursos</h2>
            <p className={css.descricao}>Videoaulas e materiais dos seus professores.</p>
            <div className={css.destaque}>
              {proximoCurso?.continuar ? <>
                <p>{pct(proximoCurso.porcentagem) > 0 ? "Continue de onde parou" : "Sua primeira aula"}</p>
                <Link href={`/aluno/aulas/${proximoCurso.continuar.aula_id}`}>{proximoCurso.continuar.titulo}</Link>
                <small>{proximoCurso.curso.titulo} · {pct(proximoCurso.porcentagem)}%</small>
              </> : <p>{cursos.length ? "Todas as aulas concluídas. Parabéns!" : "Ainda não há cursos para as suas turmas."}</p>}
            </div>
            <div className={css.acoes}>
              {proximoCurso?.continuar && <Link href={`/aluno/aulas/${proximoCurso.continuar.aula_id}`} className={css.principal}><Play size={17} aria-hidden="true" />{pct(proximoCurso.porcentagem) > 0 ? "Continuar estudando" : "Começar a estudar"}</Link>}
              <Link href="/aluno/cursos" className={css.secundario}>Ver cursos<ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </article>

        <article className={`${css.atalho} cartao-interativo`} aria-labelledby="atalho-simulados">
          <div className={css.visual}><Timer size={44} strokeWidth={1.6} aria-hidden="true" /><span>Simulados</span></div>
          <div className={css.conteudo}>
            <span className={css.etiqueta}>Prática e conhecimento</span>
            <h2 id="atalho-simulados" className={css.tituloAtalho}>Seus simulados</h2>
            <p className={css.descricao}>Simulados da turma com cronômetro e treinos livres.</p>
            <div className={css.destaque}>
              {proximoSimulado ? <>
                <p>{simulados.tentativas.get(proximoSimulado.id) ? "Em andamento" : "Disponível para fazer"}</p>
                <Link href={`/aluno/simulados/${proximoSimulado.id}`}>{proximoSimulado.titulo}</Link>
                <small>{sim.paraFazer === 1 ? "1 simulado da turma para fazer" : `${sim.paraFazer} simulados da turma para fazer`}</small>
              </> : <p>Nenhum simulado da turma pendente. Que tal um treino?</p>}
            </div>
            <div className={css.acoes}>
              {proximoSimulado && <Link href={`/aluno/simulados/${proximoSimulado.id}`} className={css.principal}><Play size={17} aria-hidden="true" />{simulados.tentativas.get(proximoSimulado.id) ? "Continuar" : "Fazer agora"}</Link>}
              <Link href="/aluno/simulados" className={proximoSimulado ? css.secundario : css.principal}>{proximoSimulado ? "Ver simulados" : "Montar treino"}<ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </article>
      </div>

      <div className={css.inferior}>
        <section aria-labelledby="titulo-turmas" className={`${css.cartao} cartao-interativo`}>
          <div className={css.cabecalhoCartao}>
            <span className={css.iconeCartao} data-icone aria-hidden="true"><UsersRound size={22} strokeWidth={2.2} /></span>
            <div><h2 id="titulo-turmas">Minhas turmas</h2><p>{turmas.length === 1 ? "1 turma" : `${turmas.length} turmas`}</p></div>
          </div>
          {turmas.length === 0 ? (
            <p className={css.texto}>Você ainda não está em nenhuma turma. Peça o código ao seu professor.</p>
          ) : (
            <ul className={css.turmas}>
              {turmas.map((t) => (
                <li key={`${t.turma_nome}|${t.ano_letivo}`}><strong>{t.turma_nome}</strong><span>{t.ano_letivo}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-outra-turma" className={`${css.cartao} cartao-interativo`}>
          <div className={css.cabecalhoCartao}>
            <span className={css.iconeCartao} data-icone aria-hidden="true"><KeyRound size={22} strokeWidth={2.2} /></span>
            <div><h2 id="titulo-outra-turma">Entrar em outra turma</h2><p>Mudou de turma ou de ano? Digite o código que o professor passou.</p></div>
          </div>
          {erro === "codigo" && <p role="alert" className={css.erro}>Código inválido. Confira com seu professor.</p>}
          <form action={entrarEmTurmaComCodigo} className={css.formulario}>
            <label className="sr-only" htmlFor="codigo-turma">Código da turma</label>
            <input id="codigo-turma" name="codigo" required placeholder="K7P-4QX" autoCapitalize="characters" className={`${estilos.input} ${css.codigo}`} />
            <button type="submit" className={css.principal}>Entrar na turma<ArrowRight size={17} aria-hidden="true" /></button>
          </form>
        </section>
      </div>
    </div>
  );
}
