/** Tipos dos relatórios do aluno e da turma (sem Supabase: usados pelas páginas e pela Hermes). */
import type { EstadoAula } from "@/lib/aulas/progresso";

/** Uma linha da planilha de um bimestre para o aluno. `media` já na escala 0–10 (null = sem notas). */
export type BimestreAluno = { bimestre: string; turmaId: string; media: number | null; encerrado: boolean; vigente: boolean };

/**
 * Resultado do "quanto falta para a média".
 * - `porBimestre`: nota que precisa em cada bimestre restante (número cru; em `precisa` e `impossivel`).
 * - `mediaAtual`: média dos bimestres encerrados que contam.
 * - `nao_atingiu`: os 4 encerrados e abaixo da média.
 */
export type ResultadoQuantoFalta = {
  situacao: "atingiu" | "precisa" | "nao_atingiu" | "impossivel" | "sem_dados";
  porBimestre?: number;
  mediaAtual?: number;
};

/** Acerto numa matéria. `pct` de 0 a 100 (cru); `poucas` = menos de 5 questões. */
export type AcertoMateria = { materia: string; rotulo: string; acertos: number; total: number; pct: number; poucas: boolean };

export type SituacaoSimulado = "fez" | "fazendo" | "nao_entregou" | "nao_fez" | "sem_login";

export type LinhaSimuladoAluno = {
  simuladoId: string;
  titulo: string;
  abreEm: string | null;
  fechaEm: string | null;
  situacao: SituacaoSimulado;
  /** Só quando `fez`; nunca 0 para quem não entregou. */
  nota10: number | null;
  tempoSeg: number | null;
  saidas: number | null;
  tempoForaSeg: number | null;
};

export type ResumoAulas = {
  total: number;
  concluidas: number;
  comecadas: number;
  naoComecadas: number;
  aulas: { titulo: string; pct: number; estado: EstadoAula }[];
};

/** Uma atividade (coluna da planilha) do bimestre, para o aluno. `nota10` na escala 0–10; `status` só sem nota. */
export type AtividadeAluno = { titulo: string; tipo: string; nota10: number | null; status: string | null };

export type RelatorioAluno = {
  nome: string;
  turmaNome: string;
  anoLetivo: string;
  bimestres: BimestreAluno[];
  quantoFalta: ResultadoQuantoFalta;
  /** Média de aprovação da escola usada nos cálculos (a página não precisa ler de novo). */
  mediaAprovacao: number;
  /** Atividades do bimestre vigente (sem vigente: do bimestre da linha pedida), na ordem da planilha. */
  atividades: AtividadeAluno[];
  /** Nome do bimestre de `atividades`. */
  atividadesBimestre: string;
  /** Tem conta de login ligada (sem conta: simulados e aulas não aparecem). */
  temConta: boolean;
  materias: AcertoMateria[];
  /** Em ordem de abertura (o mais recente no fim). */
  simulados: LinhaSimuladoAluno[];
  treinos: LinhaSimuladoAluno[];
  /** null = nenhum curso ligado à turma (ou aluno sem conta). */
  aulas: ResumoAulas | null;
  ultimoAcesso: string | null;
  /** Nome repetido sem vínculo de conta: alguns bimestres não puderam ser juntados. */
  historicoParcial: boolean;
  frase: string;
};

export type AlunoDaTurma = {
  alunoId: string;
  nome: string;
  /** Na mesma ordem de `RelatorioTurma.mediaPorBimestre`. */
  medias: (number | null)[];
  /** Média do aluno pela mesma regra da turma: encerrados (com nota); nenhum encerrado na turma → vigente. */
  mediaRanking: number | null;
  quantoFalta: ResultadoQuantoFalta;
  temConta: boolean;
  simuladosFeitos: number;
  simuladosTotal: number;
  /** null = sem cursos ligados ou sem conta. */
  aulasConcluidas: number | null;
};

export type MediaBimestreTurma = { bimestre: string; turmaId: string; media: number | null; encerrado: boolean; vigente: boolean };

export type SimuladoDaTurma = {
  simuladoId: string;
  titulo: string;
  abreEm: string | null;
  fechaEm: string | null;
  fizeram: number;
  /** Alunos da planilha (com e sem conta). */
  total: number;
  naoFizeram: string[];
};

export type FaixaDistribuicao = { faixa: string; quantidade: number };

export type RelatorioTurma = {
  turmaNome: string;
  anoLetivo: string;
  /** Média de aprovação da escola usada nos cálculos. */
  mediaAprovacao: number;
  alunos: AlunoDaTurma[];
  mediaPorBimestre: MediaBimestreTurma[];
  /**
   * Média da turma pela regra da frase: média dos bimestres encerrados (com nota); nenhum encerrado →
   * o bimestre em andamento. `mediaTurmaBase` diz qual foi usada (null = sem notas).
   */
  mediaTurma: number | null;
  mediaTurmaBase: "encerrados" | "andamento" | null;
  abaixoDaMedia: { alunoId: string; nome: string; media: number }[];
  /** Em ordem de abertura (o mais recente no fim): o "último simulado" é sempre `simulados.at(-1)`. */
  simulados: SimuladoDaTurma[];
  /** Acerto em todas as matérias (pior primeiro). */
  materias: AcertoMateria[];
  /** As 3 matérias com menor acerto (de preferência com 5+ questões). */
  materiasFracas: AcertoMateria[];
  distribuicao: FaixaDistribuicao[];
  frase: string;
};
