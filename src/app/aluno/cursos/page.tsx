import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { resumosCursosAluno } from "@/lib/aulas/consultas";
import { BookOpen, CheckCircle2, Gauge, PlayCircle, Trophy } from "lucide-react";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { CartaoCursoAluno } from "@/components/cursos/CartaoCursoAluno";
import css from "./CursosAluno.module.css";
import { estilos } from "@/components/ui/estilos";
export const dynamic = "force-dynamic";
export default async function AlunoCursosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const resumos = await resumosCursosAluno(aluno);
  const pct = (r: (typeof resumos)[number]) => Math.max(0, Math.min(100, Math.round(r.porcentagem)));
  const concluidos = resumos.filter((r) => pct(r) === 100).length;
  const emAndamento = resumos.filter((r) => pct(r) > 0 && pct(r) < 100).length;
  const media = resumos.length ? Math.round(resumos.reduce((soma, r) => soma + pct(r), 0) / resumos.length) : 0;
  const aulas = resumos.reduce((soma, r) => soma + r.qtd_aulas, 0);
  const aulasFeitas = resumos.reduce((soma, r) => soma + r.qtd_concluidas, 0);
  const painel: ItemResumo[] = [
    { rotulo: "Em andamento", valor: String(emAndamento), detalhe: emAndamento === 1 ? "curso iniciado" : "cursos iniciados", Icone: PlayCircle },
    { rotulo: "Concluídos", valor: String(concluidos), detalhe: concluidos === 1 ? "curso finalizado" : "cursos finalizados", Icone: Trophy },
    { rotulo: "Progresso médio", valor: `${media}%`, detalhe: "em todos os cursos", Icone: Gauge },
    { rotulo: "Aulas concluídas", valor: `${aulasFeitas}/${aulas}`, detalhe: "assistidas até o fim", Icone: CheckCircle2 },
  ];
  return <div className={css.pagina} data-largura-total>
    <div className={`${css.cabecalho} cartao-interativo`}>
      <div>
        <p className={css.rotulo}>Aulas e conhecimento</p>
        <h1 className={css.tituloPagina}><span className={css.iconeTitulo} data-icone><BookOpen size={25} strokeWidth={2.2} aria-hidden="true" /></span>Seus cursos</h1>
        <p className={css.descricao}>Continue seus estudos e acompanhe cada etapa.</p>
      </div>
      {resumos.length > 0 && <span className={`${css.quantidade} cartao-interativo`}><BookOpen size={19} aria-hidden="true" />{resumos.length} {resumos.length === 1 ? "curso disponível" : "cursos disponíveis"}</span>}
    </div>
    {resumos.length > 0 && <PainelResumo itens={painel} />}
    {resumos.length === 0 ? <p className={estilos.card + " p-5 text-sm text-ink"}>Ainda não há cursos para as suas turmas.</p> :
      <ul className={css.lista}>
        {resumos.map((resumo) => <li key={resumo.curso.id}><CartaoCursoAluno resumo={resumo} /></li>)}
      </ul>}
  </div>;
}
