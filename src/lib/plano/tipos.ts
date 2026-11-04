export type EtapaPlano = "diagnostico" | "pratica" | "revisao";

export type RegrasAprendizagem = {
  minQuestoesPrioridade: number;
  taxaErroPrioridade: number;
  questoesPratica: number;
  questoesDiagnostico: number;
  questoesRevisao: number;
  diasRevisao: number;
  metaAcerto: number;
  diasSemRepetir: number;
  minutosPorQuestao: number;
  minutosMaterial: number;
};

/** Tópico em que o conteúdo mais errou (ver "Escolha do foco" da spec). */
export type Foco = { topicoId: string; nome: string; erros: number; questoes: number };
