/** Uma resposta de um aluno a uma questão, numa atividade (simulado do professor ou treino) entregue. */
export type RespostaDesempenho = {
  contaId: string; tentativaId: string; atividadeId: string; atividadeTitulo: string;
  tipo: "professor" | "treino"; entregueEm: string; // ISO
  questaoId: string; materia: string | null; assuntoId: string | null; assuntoNome: string | null;
  alternativa: "A" | "B" | "C" | "D" | "E" | null; correta: boolean | null; anulada: boolean;
};

export type ResumoGeral = { respondidas: number; acertos: number; erros: number; emBranco: number; taxaAcerto: number /* 0–100, inteiro arredondado */; refeitas: number };

export type ConteudoDesempenho = { chave: string /* assuntoId ou "materia:<m>" */; materia: string | null; materiaRotulo: string; assuntoId: string | null; nome: string /* assunto ou "<Matéria> (sem assunto)" */; questoes: number; acertos: number; erros: number; emBranco: number; taxaErro: number /* 0–100 inteiro */; legenda: string };

export type MateriaDesempenho = { materia: string; rotulo: string; questoes: number; acertos: number; erros: number; emBranco: number; taxaAcerto: number; conteudos: ConteudoDesempenho[] };

export type AtividadeEvolucao = { atividadeId: string; titulo: string; entregueEm: string; acertos: number; total: number; pct: number };

export type Comparacao = { atual: AtividadeEvolucao; anterior: AtividadeEvolucao; diferenca: number /* pontos */; texto: string };

export type Prioridade = { tipo: "revisar" | "mais_respostas"; conteudo: ConteudoDesempenho; texto: string };

export type PainelDesempenho = { resumo: ResumoGeral; maisErro: ConteudoDesempenho[]; materias: MateriaDesempenho[]; evolucao: AtividadeEvolucao[]; comparacao: Comparacao | null; prioridades: Prioridade[]; primeiraAtividade: string | null };
