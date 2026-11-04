import type { EtapaPlano, Foco, RegrasAprendizagem } from "./tipos";

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

export function textoRecomendacao(
  c: { tipo: "revisar" | "mais_respostas"; nome: string; erros: number; questoes: number; foco: Foco | null },
  r: RegrasAprendizagem,
): string {
  if (c.tipo === "mais_respostas") {
    return `Você respondeu só ${c.questoes} ${plural(c.questoes, "questão", "questões")} de ${c.nome} e errou ${c.erros}. Precisamos de mais respostas: resolva ${r.questoesDiagnostico} questões de diagnóstico para entender melhor.`;
  }
  const base = `Você errou ${c.erros} de ${c.questoes} questões de ${c.nome}`;
  const fim = `e depois resolva uma sequência de ${r.questoesPratica} questões, começando pelas mais simples.`;
  if (c.foco) return `${base}, ${c.foco.erros} delas sobre ${c.foco.nome}. Revise esse tópico ${fim}`;
  return `${base}. Revise esse conteúdo ${fim}`;
}

export function textoCriterio(r: RegrasAprendizagem): string {
  return `Sugestão pelo critério: ${r.minQuestoesPrioridade} ou mais questões e ${r.taxaErroPrioridade}% ou mais de erro. Um resultado isolado não comprova uma dificuldade.`;
}

export function formatarMinutos(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto}`;
}

export function textoSemMaterial(nome: string, temResolucao: boolean): string {
  const base = `Ainda não há material de revisão para ${nome}.`;
  return temResolucao ? base : `${base} Peça ao seu professor uma indicação.`;
}

export function textoQuestoesDisponiveis(nome: string, disponiveis: number, pedidas: number): string | null {
  if (disponiveis >= pedidas) return null;
  if (disponiveis <= 0) return `Não há questões novas de ${nome} no banco agora.`;
  const novas = plural(disponiveis, "questão nova", "questões novas");
  return `Só há ${disponiveis} ${novas} de ${nome} agora; a sequência terá ${disponiveis}.`;
}

export function textoResolucoes(n: number): string {
  return n === 1
    ? "Releia a resolução da questão que você errou"
    : `Releia as resoluções das ${n} questões que você errou`;
}

const PREFIXO: Record<EtapaPlano, string> = { diagnostico: "Diagnóstico", pratica: "Prática", revisao: "Revisão" };

/** Título do treino do plano, limitado a 120 caracteres. */
export function tituloTreino(etapa: EtapaPlano, nome: string): string {
  return `${PREFIXO[etapa]}: ${nome}`.slice(0, 120);
}
