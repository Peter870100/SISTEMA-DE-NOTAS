import type { CSSProperties } from "react";
import { linkDetalhe, chaveMateria } from "@/components/desempenho/links";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import type { ConteudoPlano, Etapa, EtapaPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import { formatarMinutos, textoQuestoesDisponiveis } from "@/lib/plano/textos";
import { BotaoJaRevisei } from "./BotaoJaRevisei";
import { BotaoTreinoPlano } from "./BotaoTreinoPlano";
import { dataCurta, quantidadeDaEtapa, rotuloEtapa } from "./rotulos";
import { MateriaisConteudo } from "./MateriaisConteudo";
import { SeloPlano } from "./SeloPlano";
import css from "./PlanoEstudo.module.css";

const SEM_EXTRAS: ExtrasConteudo = { materiais: [], resolucoes: 0, disponiveis: null, prerequisitos: [], habilidades: [] };
const TITULO: Record<Etapa["tipo"], string> = { revisar: "Revisar o conteúdo", pratica: "Praticar", revisao: "Revisão", diagnostico: "Diagnóstico" };
const ULTIMO: Record<Etapa["tipo"], string> = { revisar: "Última revisão", pratica: "Última prática", revisao: "Última revisão", diagnostico: "Último diagnóstico" };

function estadoTexto(e: Etapa): string {
  if (e.estado === "feita") return "Feita ✓";
  if (e.estado === "disponivel") return "Agora";
  return e.disponivelEm ? `A partir de ${dataCurta(e.disponivelEm)}` : "Depois da prática";
}

/** Botão de treino com os avisos de falta de questões. */
function AcaoTreino({ c, etapa, aberto, extras, regras, rotulo }: {
  c: ConteudoPlano; etapa: EtapaPlano; aberto: string | null; extras: ExtrasConteudo; regras: RegrasAprendizagem; rotulo?: string;
}) {
  const n = quantidadeDaEtapa(etapa, regras);
  const aviso = extras.disponiveis === null || aberto ? null : textoQuestoesDisponiveis(c.nome, extras.disponiveis, n);
  const esconder = extras.disponiveis === 0 && !aberto;
  return (
    <>
      {aviso && <p className={css.aviso}>{aviso}</p>}
      {!esconder && <BotaoTreinoPlano conteudo={c.chave} etapa={etapa} treinoAberto={aberto} rotulo={rotulo ?? rotuloEtapa(etapa, regras, aberto !== null, c.situacao)} />}
    </>
  );
}

function AcoesEtapa({ c, e, extras, regras }: { c: ConteudoPlano; e: Etapa; extras: ExtrasConteudo; regras: RegrasAprendizagem }) {
  if (e.tipo === "revisar") {
    return (
      <>
        <MateriaisConteudo nome={c.nome} extras={extras} visao="aluno" hrefResolucoes={linkDetalhe("/aluno/desempenho", chaveMateria(c.inicial), c.chave) + "#detalhe-conteudo"} />
        {e.estado !== "feita" && <BotaoJaRevisei conteudo={c.chave} />}
      </>
    );
  }
  if (e.estado === "feita") return null;
  if (e.tipo === "revisao" && e.estado !== "disponivel") return null;
  return <AcaoTreino c={c} etapa={e.tipo} aberto={e.treinoAberto} extras={extras} regras={regras} />;
}

export function CartaoConteudoPlano({ c, extras, regras, i, criterio, compacto }: {
  c: ConteudoPlano; extras: ExtrasConteudo | undefined; regras: RegrasAprendizagem; i: number; criterio: string; compacto?: boolean;
}) {
  const ex = extras ?? SEM_EXTRAS;
  const concluido = c.situacao === "concluido";
  const praticaAberta = c.etapas.find((e) => e.tipo === "pratica")?.treinoAberto ?? null;
  const proxima = c.etapas.find((e) => e.estado === "disponivel");

  return (
    <li id={`conteudo-${c.chave}`} className={`${css.conteudo} cartao-interativo`} data-situacao={c.situacao} style={{ "--i": Math.min(i, 15) } as CSSProperties}>
      <div className={css.topo}>
        <p className={css.materia}>{c.materiaRotulo}</p>
        <h3 className={css.nome}>{c.nome}</h3>
        <div className={css.etiquetas}>
          <span className={css.etiqueta} data-situacao={c.situacao}>{c.etiqueta}</span>
          <SeloPlano c={c} />
        </div>
      </div>
      <div className={css.corpo}>
        {concluido ? (
          <>
            <p className={css.texto}>Antes: {c.inicial.legenda}</p>
            {c.depois && <p className={css.texto}>Depois do estudo: acertou {c.depois.acertos} de {c.depois.total}</p>}
            <div className={css.acoes}>
              <AcaoTreino c={c} etapa="pratica" aberto={praticaAberta} extras={ex} regras={regras} rotulo="Estudar de novo" />
            </div>
          </>
        ) : (
          <>
            <p className={css.texto}>{c.texto}</p>
            <p className={css.criterio}>{criterio}</p>
            {c.aviso && <p className={css.aviso}>{c.aviso}</p>}
            {!compacto && ex.prerequisitos.length > 0 && (
              <p className={css.contexto}>{ex.prerequisitos.map((p) => `Antes, é bom saber: ${p.nome} (${p.assunto})`).join(" · ")}</p>
            )}
            {!compacto && ex.habilidades.length > 0 && (
              <ul className={css.habilidades}>{ex.habilidades.map((h, k) => <li key={k}>{h.codigo ? `${h.codigo} — ` : ""}{h.descricao}</li>)}</ul>
            )}
            {compacto ? (
              proxima && <div className={css.acoes}><AcoesEtapa c={c} e={proxima} extras={ex} regras={regras} /></div>
            ) : (
              <ol className={css.etapas}>
                {c.etapas.map((e, k) => (
                  <li key={e.tipo} className={css.etapa} data-estado={e.estado}>
                    <div className={css.etapaTopo}>
                      <span className={css.numero} aria-hidden="true">{k + 1}</span>
                      <strong>{TITULO[e.tipo]}</strong>
                      <span className={css.estadoEtapa}>{estadoTexto(e)}</span>
                      <span className={css.minutos}>≈ {formatarMinutos(e.minutos)}</span>
                    </div>
                    {e.resultado && <p className={css.resultado}>{ULTIMO[e.tipo]}: acertou {e.resultado.acertos} de {e.resultado.total}</p>}
                    <div className={css.acoes}><AcoesEtapa c={c} e={e} extras={ex} regras={regras} /></div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </li>
  );
}
