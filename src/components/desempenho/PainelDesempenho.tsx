import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { type LucideIcon, ArrowLeft, ArrowRight, ChartColumn, CircleCheck, CircleX, ClipboardList, Flag, Library, ListChecks, Percent, Target, TrendingUp } from "lucide-react";
import type { QuestaoErrada } from "@/lib/desempenho/dados";
import { AVISO_DIFICULDADE } from "@/lib/desempenho/regras";
import type { PainelDesempenho as Painel, Prioridade } from "@/lib/desempenho/tipos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { TreinarAssunto } from "@/components/simulados/TreinarAssunto";
import { AulasDoConteudo, DetalheConteudo } from "./DetalheConteudo";
import { GraficoConteudos } from "./GraficoConteudos";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { chaveMateria, linkDetalhe } from "./links";
import css from "./PainelDesempenho.module.css";

type Aula = { id: string; titulo: string };
type Visao = "aluno" | "escola";

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const data = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Secao({ id, titulo, Icone, children }: { id: string; titulo: string; Icone: LucideIcon; children: ReactNode }) {
  return (
    <section className={css.cartao} aria-labelledby={id}>
      <h2 id={id} className={css.tituloSecao}><span className={css.iconeSecao} data-icone><Icone size={21} strokeWidth={2.2} aria-hidden="true" /></span>{titulo}</h2>
      {children}
    </section>
  );
}

function CartaoPrioridade({ p, visao, aulas, hrefBase, i }: { p: Prioridade; visao: Visao; aulas: Aula[]; hrefBase: string; i: number }) {
  const c = p.conteudo;
  return (
    <li className={`${css.prioridade} cartao-interativo`} data-tipo={p.tipo} style={vars({ "--i": Math.min(i, 15) })}>
      <span className={css.etiqueta}>{p.tipo === "revisar" ? "Revisão prioritária" : "Precisamos de mais respostas"}</span>
      <div>
        <p className={css.rotulo}>{c.materiaRotulo}</p>
        <h3 className={css.nomePrioridade}>{c.nome}</h3>
      </div>
      <p className={css.textoPrioridade}>{p.texto}</p>
      <div className={css.acoes}>
        <AulasDoConteudo conteudo={c} aulas={aulas} visao={visao} />
        {visao === "aluno" && <TreinarAssunto assuntoId={c.assuntoId} materia={c.materia} nome={c.nome} className={css.botaoTreinar} />}
        <Link href={linkDetalhe(hrefBase, chaveMateria(c), c.chave)} scroll={false} className={css.botaoVer}>Ver questões<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </li>
  );
}

/** Painel "Meu desempenho" (aluno) e "Desempenho de <nome>" (escola): mesmo componente, links pela URL. */
export function PainelDesempenho({ painel, visao, titulo, hrefBase, materiaAberta, conteudoAberto, erradas, aulas, voltar }: {
  painel: Painel; visao: Visao; titulo: string; hrefBase: string;
  materiaAberta: string | null; conteudoAberto: string | null;
  erradas: QuestaoErrada[]; aulas: Aula[]; voltar?: { href: string; rotulo: string };
}) {
  const { resumo, comparacao } = painel;
  const atividades = painel.evolucao.length;
  const semHistorico = resumo.respondidas === 0;
  const materia = painel.materias.find((m) => m.materia === materiaAberta) ?? null;
  const conteudo = materia?.conteudos.find((c) => c.chave === conteudoAberto) ?? null;

  const itens: ItemResumo[] = [
    { rotulo: "Respondidas", valor: String(resumo.respondidas), detalhe: resumo.refeitas > 0 ? `refez ${resumo.refeitas}` : "questões diferentes", Icone: ListChecks },
    { rotulo: "Acertos", valor: String(resumo.acertos), detalhe: "na primeira resposta", Icone: CircleCheck },
    { rotulo: "Erros", valor: String(resumo.erros), detalhe: resumo.emBranco > 0 ? `+ ${resumo.emBranco} em branco` : "nenhuma em branco", Icone: CircleX },
    { rotulo: "Taxa de acerto", valor: `${resumo.taxaAcerto}%`, detalhe: "das respondidas", Icone: Percent },
  ];

  return (
    <div className={css.pagina} data-largura-total>
      <header className={`${css.cabecalho} cartao-interativo`}>
        <div className={css.cabecalhoTexto}>
          {voltar && <Link href={voltar.href} className={css.voltar}><ArrowLeft size={16} aria-hidden="true" />{voltar.rotulo}</Link>}
          <p className={css.rotulo}>{visao === "aluno" ? "Seu histórico" : "Acompanhamento do aluno"}</p>
          <h1 className={css.tituloPagina}><span className={css.iconeTitulo} data-icone><ChartColumn size={25} strokeWidth={2.2} aria-hidden="true" /></span>{titulo}</h1>
          <p className={css.descricao}>
            {painel.primeiraAtividade ? `Desde ${data(painel.primeiraAtividade)}, somando simulados e treinos entregues.` : "Simulados e treinos entregues aparecem aqui."}
          </p>
        </div>
        {atividades > 0 && <span className={`${css.quantidade} cartao-interativo`}><ClipboardList size={20} aria-hidden="true" />{plural(atividades, "atividade", "atividades")}</span>}
      </header>

      {semHistorico ? (
        <section className={`${css.cartao} ${css.semHistorico}`} aria-label="Sem histórico">
          <span className={css.iconeSecao} data-icone><ClipboardList size={22} aria-hidden="true" /></span>
          <p>{visao === "aluno" ? "Você ainda não entregou nenhum simulado ou treino" : "Este aluno ainda não entregou nenhum simulado ou treino"}</p>
          {visao === "aluno" && <Link href="/aluno/simulados" className={css.botaoTreinar}>Ir para os simulados<ArrowRight size={17} aria-hidden="true" /></Link>}
        </section>
      ) : (
        <>
          <PainelResumo itens={itens} />

          <div className={css.duasColunas}>
            <Secao id="titulo-mais-erro" titulo="Conteúdos com mais erro" Icone={Target}>
              {painel.maisErro.length === 0
                ? <p className={css.vazio}>Nenhum erro até agora. Continue assim!</p>
                : <>
                    <p className={css.legenda}>Da maior para a menor taxa de erro. Toque no nome para ver as questões.</p>
                    <GraficoConteudos conteudos={painel.maisErro} hrefBase={hrefBase} aberto={conteudo?.chave ?? null} />
                  </>}
            </Secao>

            <Secao id="titulo-evolucao" titulo="Evolução" Icone={TrendingUp}>
              <p className={css.legenda}>Acerto em cada atividade, da mais antiga para a mais recente.</p>
              <GraficoEvolucao atividades={painel.evolucao} />
              {comparacao
                ? <p className={css.comparacao} data-tom={comparacao.diferenca > 0 ? "sobe" : comparacao.diferenca < 0 ? "desce" : "igual"}>{comparacao.texto}</p>
                : <p className={css.comparacao} data-tom="igual">Com mais uma atividade entregue, aparece a comparação entre as duas últimas.</p>}
              <p className={css.aviso}>{AVISO_DIFICULDADE}</p>
            </Secao>
          </div>

          <Secao id="titulo-prioridades" titulo="Prioridades de revisão" Icone={Flag}>
            {painel.prioridades.length === 0
              ? <p className={css.vazio}>Nenhum assunto pede revisão agora.</p>
              : <ul className={css.prioridades}>
                  {painel.prioridades.map((p, i) => <CartaoPrioridade key={p.conteudo.chave} p={p} visao={visao} aulas={aulas} hrefBase={hrefBase} i={i} />)}
                </ul>}
          </Secao>

          <Secao id="titulo-materias" titulo="Matérias" Icone={Library}>
            <p className={css.legenda}>Escolha uma matéria para ver os conteúdos dela. A de menor acerto vem primeiro.</p>
            <ul className={css.materias}>
              {painel.materias.map((m, i) => {
                const aberta = m.materia === materia?.materia;
                return (
                  <li key={m.materia} style={vars({ "--i": Math.min(i, 15) })}>
                    <Link href={aberta ? hrefBase : linkDetalhe(hrefBase, m.materia)} scroll={false} className={`${css.materia} cartao-interativo`} data-aberta={aberta || undefined} aria-current={aberta ? "true" : undefined}>
                      <span className={css.materiaTopo}><strong>{m.rotulo}</strong><span className={css.materiaPct}>{m.taxaAcerto}%</span></span>
                      <span className={css.barra} aria-hidden="true"><span style={vars({ "--pct": `${m.taxaAcerto}%` })} /></span>
                      <span className={css.materiaDetalhe}>{plural(m.acertos, "acerto", "acertos")} em {plural(m.questoes, "questão", "questões")}{m.emBranco > 0 ? ` · ${m.emBranco} em branco` : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {materia && (
              <div className={css.materiaAberta}>
                <h3 className={css.subtitulo}>{materia.rotulo}: conteúdos</h3>
                <GraficoConteudos conteudos={materia.conteudos} hrefBase={hrefBase} aberto={conteudo?.chave ?? null} />
                {conteudo && <DetalheConteudo conteudo={conteudo} erradas={erradas} aulas={aulas} visao={visao} hrefFechar={linkDetalhe(hrefBase, materia.materia)} />}
              </div>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}
