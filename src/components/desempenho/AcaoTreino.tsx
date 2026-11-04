import { BotaoTreinoPlano } from "@/components/plano/BotaoTreinoPlano";
import { quantidadeDaEtapa, rotuloEtapa } from "@/components/plano/rotulos";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import { textoQuestoesDisponiveis } from "@/lib/plano/textos";
import type { ConteudoPlano, EtapaPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import css from "./PainelDesempenho.module.css";

/** Botão de treino do plano para o conteúdo (só na visão do aluno); sem questões novas, mostra o aviso. */
export function AcaoTreino({ cp, extras, regras }: { cp: ConteudoPlano | undefined; extras: ExtrasConteudo | undefined; regras: RegrasAprendizagem }) {
  if (!cp) return null;
  const etapa: EtapaPlano = cp.situacao === "mais_respostas" ? "diagnostico" : "pratica";
  const aberto = cp.etapas.find((e) => e.tipo === etapa)?.treinoAberto ?? null;
  if (!aberto && extras?.disponiveis === 0) {
    const aviso = textoQuestoesDisponiveis(cp.nome, 0, quantidadeDaEtapa(etapa, regras));
    return aviso ? <p className={css.semAula}>{aviso}</p> : null;
  }
  return <BotaoTreinoPlano conteudo={cp.chave} etapa={etapa} treinoAberto={aberto} rotulo={rotuloEtapa(etapa, regras, !!aberto, cp.situacao)} className={css.botaoTreinar} />;
}
