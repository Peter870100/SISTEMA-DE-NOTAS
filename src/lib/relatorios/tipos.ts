/** Tipos dos relatórios do aluno e da turma (sem Supabase: usados pelas páginas e pela Hermes). */

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
  aulas: { titulo: string; pct: number; concluida: boolean }[];
};

export type RelatorioAluno = {
  nome: string;
  turmaNome: string;
  anoLetivo: string;
  bimestres: BimestreAluno[];
  quantoFalta: ResultadoQuantoFalta;
  materias: AcertoMateria[];
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
  alunos: AlunoDaTurma[];
  mediaPorBimestre: MediaBimestreTurma[];
  abaixoDaMedia: { alunoId: string; nome: string; media: number }[];
  simulados: SimuladoDaTurma[];
  /** As 3 matérias com menor acerto (de preferência com 5+ questões). */
  materiasFracas: AcertoMateria[];
  distribuicao: FaixaDistribuicao[];
  frase: string;
};
