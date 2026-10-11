import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import type { Simulado } from "@/lib/types";
import { CartaoSimuladoAluno } from "@/components/simulados/CartaoSimuladoAluno";
import { CheckCircle2, ClipboardList, Hourglass, ListTodo, Target, Timer, UsersRound } from "lucide-react";
import { correcaoLiberada, formatarDuracao, situacaoSimulado, tempoDeProvaSeg } from "@/lib/simulados/regras";
import { NovoTreino } from "@/components/simulados/NovoTreino";
import css from "./SimuladosAluno.module.css";

export const dynamic = "force-dynamic";

export default async function AlunoSimuladosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const turmas = await turmasDoAluno(aluno.id);
  const minhas = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const nomes = [...new Set(turmas.map((t) => t.turma_nome))];

  let daTurma: Simulado[] = [];
  if (nomes.length > 0) {
    const { data: alvos } = await supabase.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").eq("escola_id", aluno.escola_id).in("turma_nome", nomes);
    const ids = [...new Set((alvos ?? []).filter((a) => minhas.has(`${a.turma_nome}|${a.ano_letivo}`)).map((a) => a.simulado_id))];
    if (ids.length > 0) {
      const { data } = await supabase.from("simulados").select("*").in("id", ids).eq("escola_id", aluno.escola_id).eq("tipo", "professor").eq("status", "publicado").order("created_at", { ascending: false });
      daTurma = data ?? [];
    }
  }
  const { data: treinosData } = await supabase.from("simulados").select("*").eq("escola_id", aluno.escola_id).eq("tipo", "treino").eq("conta_id", aluno.id).order("created_at", { ascending: false }).limit(50);
  const treinos = treinosData ?? [];

  const exibidos = new Set([...daTurma, ...treinos].map((s) => s.id));
  const { data: tentData, error: erroTent } = await supabase.from("tentativas").select("simulado_id, status, porcentagem, total, iniciada_em, entregue_em, prazo_em, tempo_usado_seg").eq("conta_id", aluno.id);
  if (erroTent) throw new Error(erroTent.message);
  const tentativas = new Map((tentData ?? []).filter((t) => exibidos.has(t.simulado_id)).map((t) => [t.simulado_id, t]));
  const agora = new Date();

  // Painel: só notas já liberadas entram na média (prova do professor em sigilo fica de fora).
  const todos = [...daTurma, ...treinos];
  const comNota = todos.filter((s) => tentativas.get(s.id)?.status === "entregue" && correcaoLiberada(s, agora));
  const notas = comNota.map((s) => tentativas.get(s.id)?.porcentagem).filter((p): p is number => p != null).map(Number);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const tempoTotal = todos.reduce((soma, s) => {
    const t = tentativas.get(s.id);
    return soma + (t?.status === "entregue" ? tempoDeProvaSeg(s.tipo, t) ?? 0 : 0);
  }, 0);
  const paraFazer = daTurma.filter((s) => {
    const t = tentativas.get(s.id);
    return t ? t.status === "em_andamento" : situacaoSimulado(s, agora) === "aberto";
  }).length;
  const painel = [
    { rotulo: "Para fazer", valor: String(paraFazer), detalhe: "simulados da turma", Icone: ListTodo },
    { rotulo: "Concluídos", valor: String(comNota.length), detalhe: "com resultado", Icone: CheckCircle2 },
    { rotulo: "Média de acerto", valor: media == null ? "—" : `${media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, detalhe: "nos concluídos", Icone: Target },
    { rotulo: "Tempo de prova", valor: tempoTotal ? formatarDuracao(tempoTotal) : "—", detalhe: "somando as entregas", Icone: Hourglass },
  ];

  return (
    <div className={css.pagina} data-largura-total>
      <header className={css.cabecalho}>
        <div><p className={css.rotulo}>Prática e conhecimento</p><h1 className={css.tituloPagina}><span className={css.iconeTitulo}><Timer size={25} strokeWidth={2.2} aria-hidden="true" /></span>Seus simulados</h1><p className={css.descricao}>Treine no seu ritmo e acompanhe seus resultados.</p></div>
        <span className={css.quantidade}><ClipboardList size={20} aria-hidden="true" />{daTurma.length + treinos.length} {daTurma.length + treinos.length === 1 ? "atividade" : "atividades"}</span>
      </header>
      <dl className={css.painel} aria-label="Resumo">
        {painel.map(({ rotulo, valor, detalhe, Icone }) => (
          <div key={rotulo}>
            <span className={css.painelIcone} aria-hidden="true"><Icone size={22} strokeWidth={2.2} /></span>
            <div><dt>{rotulo}</dt><dd>{valor}</dd><p>{detalhe}</p></div>
          </div>
        ))}
      </dl>
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
