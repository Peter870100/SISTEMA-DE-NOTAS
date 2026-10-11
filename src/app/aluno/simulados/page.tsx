import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { simuladosDoAluno } from "@/lib/simulados/servidor";
import { CartaoSimuladoAluno } from "@/components/simulados/CartaoSimuladoAluno";
import { CheckCircle2, ClipboardList, Hourglass, ListTodo, Target, Timer, UsersRound } from "lucide-react";
import { formatarDuracao, resumoSimulados } from "@/lib/simulados/regras";
import { NovoTreino } from "@/components/simulados/NovoTreino";
import { PainelResumo, type ItemResumo } from "@/components/aluno/PainelResumo";
import css from "./SimuladosAluno.module.css";

export const dynamic = "force-dynamic";

export default async function AlunoSimuladosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const { daTurma, treinos, tentativas } = await simuladosDoAluno(aluno);
  const agora = new Date();
  const { paraFazer, concluidos, media, tempoTotalSeg } = resumoSimulados(daTurma, treinos, tentativas, agora);
  const painel: ItemResumo[] = [
    { rotulo: "Para fazer", valor: String(paraFazer), detalhe: "simulados da turma", Icone: ListTodo },
    { rotulo: "Concluídos", valor: String(concluidos), detalhe: "com resultado", Icone: CheckCircle2 },
    { rotulo: "Média de acerto", valor: media == null ? "—" : `${media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, detalhe: "nos concluídos", Icone: Target },
    { rotulo: "Tempo de prova", valor: tempoTotalSeg ? formatarDuracao(tempoTotalSeg) : "—", detalhe: "somando as entregas", Icone: Hourglass },
  ];

  return (
    <div className={css.pagina} data-largura-total>
      <header className={`${css.cabecalho} cartao-interativo`}>
        <div><p className={css.rotulo}>Prática e conhecimento</p><h1 className={css.tituloPagina}><span className={css.iconeTitulo} data-icone><Timer size={25} strokeWidth={2.2} aria-hidden="true" /></span>Seus simulados</h1><p className={css.descricao}>Treine no seu ritmo e acompanhe seus resultados.</p></div>
        <span className={`${css.quantidade} cartao-interativo`}><ClipboardList size={20} aria-hidden="true" />{daTurma.length + treinos.length} {daTurma.length + treinos.length === 1 ? "atividade" : "atividades"}</span>
      </header>
      <PainelResumo itens={painel} />
      <div className={css.colunas}>
        <div className={css.principal}>
          <section aria-labelledby="titulo-turma" className={css.secao}>
            <h2 id="titulo-turma" className={css.tituloSecao}><UsersRound size={23} aria-hidden="true" />Da turma<span>{daTurma.length}</span></h2>
            {daTurma.length === 0 ? <p className={css.vazio}>Nenhum simulado da turma por enquanto.</p> : <ul className={css.lista}>
              {daTurma.map((s) => <li key={s.id}><CartaoSimuladoAluno simulado={s} tentativa={tentativas.get(s.id)} agora={agora} /></li>)}
            </ul>}
          </section>
          <section aria-labelledby="titulo-treinos" className={css.secao}>
            <div className={css.cabecalhoSecao}>
              <h2 id="titulo-treinos" className={css.tituloSecao}><Timer size={23} aria-hidden="true" />Meus treinos<span>{treinos.length}</span></h2>
              <a href="#novo-treino" className={css.atalho}>+ Novo treino</a>
            </div>
            {treinos.length === 0 && <p className={css.vazio}>Você ainda não fez treinos. Monte o primeiro em “Novo treino”.</p>}
            {treinos.length > 0 && <ul className={css.lista}>
              {treinos.map((s) => <li key={s.id}><CartaoSimuladoAluno simulado={s} tentativa={tentativas.get(s.id)} agora={agora} /></li>)}
            </ul>}
          </section>
        </div>
        <aside id="novo-treino" className={css.lateral} aria-label="Montar novo treino">
          <NovoTreino compacto />
        </aside>
      </div>
    </div>
  );
}
