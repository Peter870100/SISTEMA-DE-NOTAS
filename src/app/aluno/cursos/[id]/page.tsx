import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleDashed, Clock3, Layers3, Play, PlayCircle } from "lucide-react";
import { formatarDuracao } from "@/lib/simulados/regras";
import { getAlunoAtual } from "@/lib/auth";
import { cursoVisivelParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso, progressoDoAluno } from "@/lib/aulas/consultas";
import { estadoAula, porcentagemAula, porcentagemAssistida } from "@/lib/aulas/progresso";
import { ProgressoCurso } from "@/components/aulas/ProgressoCurso";
import { MiniaturaAula } from "@/components/cursos/MiniaturaAula";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import css from "./CursoAluno.module.css";

export const dynamic = "force-dynamic";

const ROTULO = { concluida: "Concluída", andamento: "Em andamento", nao_iniciada: "Não iniciada" } as const;

export default async function AlunoCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const curso = await cursoVisivelParaAluno(aluno, id);
  if (!curso) notFound();
  const [arvore, progresso] = await Promise.all([arvoreDoCurso(id, true), progressoDoAluno(aluno.id, id)]);
  const modulos = arvore.filter((m) => m.aulas.length > 0);
  const todas = modulos.flatMap((m) => m.aulas);
  const total = porcentagemAssistida(todas, progresso);
  const estados = todas.map((a) => estadoAula(progresso.get(a.id) ?? null));
  const concluidas = estados.filter((e) => e === "concluida").length;
  const emAndamento = estados.filter((e) => e === "andamento").length;
  const assistidoSeg = todas.reduce((soma, a) => {
    const p = progresso.get(a.id);
    return soma + (p ? Math.min(p.maior_posicao_seg, p.duracao_seg ?? p.maior_posicao_seg) : 0);
  }, 0);

  // Próxima aula: a em andamento mais recente; senão, a primeira não concluída.
  const andamento = todas
    .filter((a) => estadoAula(progresso.get(a.id) ?? null) === "andamento")
    .sort((x, y) => Date.parse(progresso.get(y.id)!.atualizado_em) - Date.parse(progresso.get(x.id)!.atualizado_em))[0];
  const proxima = andamento ?? todas.find((a) => estadoAula(progresso.get(a.id) ?? null) !== "concluida");
  const posicaoProxima = proxima ? todas.findIndex((a) => a.id === proxima.id) + 1 : 0;

  const painel: ItemResumo[] = [
    { rotulo: "Tempo assistido", valor: assistidoSeg ? formatarDuracao(assistidoSeg) : "—", detalhe: "somando todas as aulas", Icone: Clock3 },
    { rotulo: "Aulas concluídas", valor: `${concluidas}/${todas.length}`, detalhe: "assistidas até o fim", Icone: CheckCircle2 },
    { rotulo: "Em andamento", valor: String(emAndamento), detalhe: emAndamento === 1 ? "aula começada" : "aulas começadas", Icone: PlayCircle },
    { rotulo: "Módulos", valor: String(modulos.length), detalhe: `${todas.length} ${todas.length === 1 ? "aula" : "aulas"} no total`, Icone: Layers3 },
  ];

  return (
    <div className={css.pagina} data-largura-total>
      <header className={`${css.cabecalho} cartao-interativo`}>
        <Link href="/aluno/cursos" className={css.voltar}><ArrowLeft size={18} aria-hidden="true" />Seus cursos</Link>
        <div className={css.topo}>
          <div className={css.identidade}>
            <p className={css.rotulo}>{curso.disciplina || "Curso"}</p>
            <h1 className={css.titulo}><span className={css.icone} data-icone><BookOpen size={25} strokeWidth={2.2} aria-hidden="true" /></span>{curso.titulo}</h1>
            {curso.descricao && <p className={css.descricao}>{curso.descricao}</p>}
          </div>
          <div className={css.progressoGeral}>
            <p className={css.rotulo}>{total >= 100 ? "Curso concluído" : "Seu progresso"}</p>
            <ProgressoCurso porcentagem={total} rotulo="Progresso no curso" />
          </div>
        </div>
      </header>

      <PainelResumo itens={painel} />

      {proxima && (
        <section aria-labelledby="titulo-continuar" className={`${css.continuar} cartao-interativo`}>
          <MiniaturaAula caminho={proxima.capa_caminho} videoId={proxima.video_id} porcentagem={porcentagemAula(progresso.get(proxima.id) ?? null)} />
          <div className={css.continuarTexto}>
            <p id="titulo-continuar" className={css.rotulo}>{andamento ? "Continue de onde parou" : concluidas ? "Próxima aula" : "Sua primeira aula"}</p>
            <p className={css.continuarAula}>{posicaoProxima}. {proxima.titulo}</p>
          </div>
          <Link href={`/aluno/aulas/${proxima.id}`} className={css.botaoContinuar}>
            <Play size={18} aria-hidden="true" />{andamento ? "Continuar estudando" : "Começar aula"}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      )}

      {modulos.map((m, indice) => {
        const pct = porcentagemAssistida(m.aulas, progresso);
        const inicio = todas.findIndex((a) => a.id === m.aulas[0].id);
        return (
          <section key={m.id} aria-label={m.titulo} className={`${css.modulo} cartao-interativo`}>
            <div className={css.cabecalhoModulo}>
              <span className={css.numeroModulo} data-icone aria-hidden="true">{String(indice + 1).padStart(2, "0")}</span>
              <div className={css.nomeModulo}>
                <p className={css.rotulo}>{m.aulas.length} {m.aulas.length === 1 ? "aula" : "aulas"}</p>
                <h2>{m.titulo}</h2>
              </div>
              <div className={css.progressoModulo}><ProgressoCurso porcentagem={pct} rotulo={`Progresso em ${m.titulo}`} /></div>
            </div>
            <ol className={css.aulas}>
              {m.aulas.map((a, i) => {
                const p = progresso.get(a.id) ?? null;
                const estado = estadoAula(p);
                const porcento = porcentagemAula(p);
                const Icone = estado === "concluida" ? CheckCircle2 : estado === "andamento" ? PlayCircle : CircleDashed;
                return (
                  <li key={a.id}>
                    <Link href={`/aluno/aulas/${a.id}`} className={css.aula} data-estado={estado} aria-current={proxima?.id === a.id ? "step" : undefined}>
                      <MiniaturaAula caminho={a.capa_caminho} videoId={a.video_id} porcentagem={porcento} />
                      <span className={css.tituloAula}>{inicio + i + 1}. {a.titulo}</span>
                      <span className={css.estado} aria-label={estado === "andamento" ? `${ROTULO[estado]}, ${porcento}% assistido` : ROTULO[estado]}>
                        <Icone size={16} strokeWidth={2.4} aria-hidden="true" />
                        {estado === "andamento" ? <><strong>{porcento}%</strong> assistido</> : ROTULO[estado]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
