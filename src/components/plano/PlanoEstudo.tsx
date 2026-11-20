import type { ReactNode } from "react";
import Link from "next/link";
import { type LucideIcon, ArrowRight, CalendarClock, ChevronDown, CircleCheck, ClipboardList, Hourglass, Layers, ListTodo, Percent, Route, Timer, Trophy } from "lucide-react";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import type { DadosPlano } from "@/lib/plano/dados";
import { agruparPorMateria, textoQuantidadeConteudos } from "@/lib/plano/grupos";
import type { ConteudoPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import { AbrirConteudoDoLink } from "./AbrirConteudoDoLink";
import { formatarMinutos } from "@/lib/plano/textos";
import { CartaoConteudoPlano } from "./CartaoConteudoPlano";
import { TempoSemana } from "./TempoSemana";
import css from "./PlanoEstudo.module.css";

function Secao({ id, titulo, Icone, children }: { id: string; titulo: string; Icone: LucideIcon; children: ReactNode }) {
  return (
    <section className={css.cartao} aria-labelledby={id}>
      <h2 id={id} className={css.tituloSecao}><span className={css.iconeSecao} data-icone><Icone size={21} strokeWidth={2.2} aria-hidden="true" /></span>{titulo}</h2>
      {children}
    </section>
  );
}

/** Conteúdos separados por matéria; cada matéria fica recolhida até o aluno clicar nela. */
function ListaPorMateria({ lista, extras, regras, criterio, compacto }: {
  lista: ConteudoPlano[]; extras: Record<string, ExtrasConteudo | undefined>; regras: RegrasAprendizagem; criterio: string; compacto?: boolean;
}) {
  return (
    <div className={css.grupos}>
      {agruparPorMateria(lista).map((g) => (
        <details key={g.materia} className={css.grupo}>
          <summary className={css.resumoGrupo}>
            <span className={css.nomeGrupo}>{g.materia}</span>
            <span className={css.qtdGrupo}>{textoQuantidadeConteudos(g.itens.length)}</span>
            <ChevronDown className={css.setaGrupo} size={22} strokeWidth={2.4} aria-hidden="true" />
          </summary>
          <ul className={css.lista}>
            {g.itens.map((c, i) => <CartaoConteudoPlano key={c.chave} c={c} extras={extras[c.chave]} regras={regras} i={i} criterio={criterio} compacto={compacto} />)}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function PlanoEstudo({ dados }: { dados: DadosPlano }) {
  const { plano, extras, regras, painel } = dados;
  const total = plano.semana.length + plano.depois.length;
  const vazio = total + plano.concluidos.length === 0;
  const semHistorico = painel.resumo.respondidas === 0;

  const itens: ItemResumo[] = [
    { rotulo: "Progresso", valor: `${plano.progresso.pct}%`, detalhe: `${plano.progresso.feitas} de ${plano.progresso.total} ${plano.progresso.total === 1 ? "etapa" : "etapas"}`, Icone: Percent },
    { rotulo: "Conteúdos no plano", valor: String(total), detalhe: "para estudar", Icone: Layers },
    { rotulo: "Tempo desta semana", valor: `≈ ${formatarMinutos(plano.minutosDaSemana)}`, detalhe: "estimado", Icone: Timer },
    { rotulo: "Concluídos", valor: String(plano.concluidos.length), detalhe: plano.concluidos.length === 1 ? "conteúdo revisado" : "conteúdos revisados", Icone: CircleCheck },
  ];

  return (
    <div className={css.pagina} data-largura-total>
      <AbrirConteudoDoLink />
      <header className={`${css.cabecalho} cartao-interativo`}>
        <div className={css.cabecalhoTexto}>
          <p className={css.rotulo}>Seu caminho de estudo</p>
          <h1 className={css.tituloPagina}><span className={css.iconeTitulo} data-icone><Route size={25} strokeWidth={2.2} aria-hidden="true" /></span>Plano de estudo</h1>
          <p className={css.descricao}>Montado a partir do seu desempenho. Ele se atualiza quando você estuda e responde questões.</p>
        </div>
        {total > 0 && <span className={`${css.quantidade} cartao-interativo`}><ClipboardList size={20} aria-hidden="true" />{total} {total === 1 ? "conteúdo" : "conteúdos"}</span>}
      </header>

      {vazio ? (
        <section className={`${css.cartao} ${css.vazio}`} aria-label="Plano vazio">
          <span className={css.iconeSecao} data-icone><ClipboardList size={22} aria-hidden="true" /></span>
          <p>{semHistorico ? "Entregue um simulado ou treino para montarmos seu plano" : "Nenhum conteúdo pede revisão agora. Continue praticando"}</p>
          <Link href="/aluno/simulados" className={css.botaoPrincipal}>Ir para os simulados<ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      ) : (
        <>
          <PainelResumo itens={itens} />

          <Secao id="titulo-tempo" titulo="Quanto tempo você tem por semana?" Icone={Hourglass}>
            <TempoSemana minutos={plano.minutosSemana} escolhido={plano.tempoEscolhido} />
          </Secao>

          {plano.semana.length > 0 && (
            <Secao id="titulo-semana" titulo="Para esta semana" Icone={CalendarClock}>
              <ListaPorMateria lista={plano.semana} extras={extras} regras={regras} criterio={plano.criterio} />
            </Secao>
          )}

          {plano.depois.length > 0 && (
            <Secao id="titulo-depois" titulo="Depois" Icone={ListTodo}>
              <ListaPorMateria lista={plano.depois} extras={extras} regras={regras} criterio={plano.criterio} compacto />
            </Secao>
          )}

          {plano.concluidos.length > 0 && (
            <Secao id="titulo-concluidos" titulo="Concluídos" Icone={Trophy}>
              <ListaPorMateria lista={plano.concluidos} extras={extras} regras={regras} criterio={plano.criterio} compacto />
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
