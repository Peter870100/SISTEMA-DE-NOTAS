import type { ConteudoDesempenho, Prioridade } from "@/lib/desempenho/tipos";

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

/** Treino do plano (simulado tipo treino com plano_etapa), com o resultado da tentativa quando entregue. */
export type TreinoDoPlano = { simuladoId: string; conteudo: string; etapa: EtapaPlano; rodada: number; criadoEm: string; entregueEm: string | null; acertos: number | null; total: number | null };

export type TipoEtapa = "revisar" | EtapaPlano;

export type Etapa = { tipo: TipoEtapa; estado: "feita" | "disponivel" | "aguardando"; minutos: number; disponivelEm: string | null; treinoAberto: string | null; resultado: { acertos: number; total: number } | null };

export type ConteudoPlano = {
  chave: string; materia: string | null; materiaRotulo: string; assuntoId: string | null; nome: string;
  situacao: "revisar" | "mais_respostas" | "concluido"; etiqueta: string; rodada: number; texto: string; aviso: string | null;
  inicial: ConteudoDesempenho; foco: Foco | null; etapas: Etapa[]; feitas: number; total: number;
  depois: { acertos: number; total: number } | null; historico: { diagnosticos: number; praticas: number; revisoes: number }; minutosProximos: number;
};

export type Plano = {
  semana: ConteudoPlano[]; depois: ConteudoPlano[]; concluidos: ConteudoPlano[]; progresso: { feitas: number; total: number; pct: number };
  minutosSemana: number; tempoEscolhido: boolean; minutosDaSemana: number; criterio: string;
};

export type EntradaPlano = {
  conteudos: ConteudoDesempenho[]; prioridades: Prioridade[]; treinos: TreinoDoPlano[];
  revisadoEm: Record<string, string>; minutosRevisar: Record<string, number>; prerequisitos: Record<string, string[]>;
  minutosSemana: number | null; regras: RegrasAprendizagem; agora: Date;
};
