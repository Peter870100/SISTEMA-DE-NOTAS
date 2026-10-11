import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import type { Simulado } from "@/lib/types";
import { CartaoSimuladoAluno } from "@/components/simulados/CartaoSimuladoAluno";
import { ClipboardList, Timer, UsersRound } from "lucide-react";
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
  const { data: tentData, error: erroTent } = await supabase.from("tentativas").select("simulado_id, status, porcentagem, total").eq("conta_id", aluno.id);
  if (erroTent) throw new Error(erroTent.message);
  const tentativas = new Map((tentData ?? []).filter((t) => exibidos.has(t.simulado_id)).map((t) => [t.simulado_id, t]));
  const agora = new Date();

  return (
    <div className={css.pagina}>
      <header className={css.cabecalho}>
        <div><p className={css.rotulo}>Prática e conhecimento</p><h1 className={css.tituloPagina}><span className={css.iconeTitulo}><Timer size={25} strokeWidth={2.2} aria-hidden="true" /></span>Seus simulados</h1><p className={css.descricao}>Treine no seu ritmo e acompanhe seus resultados.</p></div>
        <span className={css.quantidade}><ClipboardList size={20} aria-hidden="true" />{daTurma.length + treinos.length} {daTurma.length + treinos.length === 1 ? "atividade" : "atividades"}</span>
      </header>
      <section aria-labelledby="titulo-turma" className={css.secao}>
        <h2 id="titulo-turma" className={css.tituloSecao}><UsersRound size={23} aria-hidden="true" />Da turma<span>{daTurma.length}</span></h2>
        {daTurma.length === 0 ? <p className={css.vazio}>Nenhum simulado da turma por enquanto.</p> : <ul className={css.lista}>
          {daTurma.map((s) => <li key={s.id}><CartaoSimuladoAluno simulado={s} tentativa={tentativas.get(s.id)} agora={agora} /></li>)}
        </ul>}
      </section>
      <section aria-labelledby="titulo-treinos" className={css.secao}>
        <h2 id="titulo-treinos" className={css.tituloSecao}><Timer size={23} aria-hidden="true" />Meus treinos<span>{treinos.length}</span></h2>
        <NovoTreino />
        {treinos.length > 0 && <ul className={css.lista}>
          {treinos.map((s) => <li key={s.id}><CartaoSimuladoAluno simulado={s} tentativa={tentativas.get(s.id)} agora={agora} /></li>)}
        </ul>}
      </section>
    </div>
  );
}
