import { BotaoTreinoPlano } from "@/components/plano/BotaoTreinoPlano";
import { quantidadeDaEtapa, rotuloEtapa } from "@/components/plano/rotulos";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import { etapaDeTreino } from "@/lib/plano/plano";
import { textoQuestoesDisponiveis } from "@/lib/plano/textos";
import type { ConteudoPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import css from "./PainelDesempenho.module.css";

/** Botão da próxima etapa de treino do plano (só na visão do aluno); sem questões novas, mostra o aviso. */
export function AcaoTreino({ cp, extras, regras }: { cp: ConteudoPlano | undefined; extras: ExtrasConteudo | undefined; regras: RegrasAprendizagem }) {
  const etapa = cp ? etapaDeTreino(cp) : null;
  if (!cp || !etapa) return null;
  const aberto = cp.etapas.find((e) => e.tipo === etapa)?.treinoAberto ?? null;
  if (!aberto && extras?.disponiveis === 0) {
    const aviso = textoQuestoesDisponiveis(cp.nome, 0, quantidadeDaEtapa(etapa, regras));
    return aviso ? <p className={css.semAula}>{aviso}</p> : null;
  }
  return <BotaoTreinoPlano conteudo={cp.chave} etapa={etapa} treinoAberto={aberto} rotulo={rotuloEtapa(etapa, regras, !!aberto, cp.situacao)} className={css.botaoTreinar} />;
}
