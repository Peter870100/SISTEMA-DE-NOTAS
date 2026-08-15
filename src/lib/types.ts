export type Turma = {
  id: string;
  nome: string;
  bimestre: string;
  ano_letivo: string;
  created_at: string;
};

export type Aluno = {
  id: string;
  turma_id: string;
  numero: number | null;
  nome: string;
  ordem: number;
  created_at: string;
};

export type TipoColuna = "nota" | "presenca";

export type AtividadeColuna = {
  id: string;
  turma_id: string;
  titulo: string;
  tema: string | null;
  peso: number;
  tipo: TipoColuna;
  ordem: number;
  created_at: string;
};

export type NotaCelula = {
  id: string;
  aluno_id: string;
  coluna_id: string;
  valor: number | null;
  status_texto: string | null;
  atualizado_por: string | null;
  updated_at: string;
};

export type ProfessorRole = "admin" | "professor";

export type Professor = {
  id: string;
  nome: string;
  email: string;
  role: ProfessorRole;
  email_verificado: boolean;
  senha_provisoria: boolean;
  acesso_restrito: boolean;
  telefone: string | null;
  ultimo_acesso: string | null;
  created_at: string;
};

/** Linha crua de professores (inclui hash e token) — só usada dentro de actions server-side de auth. */
export type ProfessorComSenha = Professor & {
  senha_hash: string;
  token_verificacao: string | null;
  token_verificacao_expira: string | null;
};

export type Configuracoes = {
  id: true;
  codigo_convite: string;
  updated_at: string;
};

/** Turma liberada pro professor quando `acesso_restrito` é true (por nome, vale pra todo bimestre). */
export type ProfessorTurmaAcesso = {
  professor_id: string;
  turma_nome: string;
};

export type NotaHistorico = {
  id: string;
  aluno_id: string;
  coluna_id: string;
  valor_anterior: number | null;
  status_anterior: string | null;
  valor_novo: number | null;
  status_novo: string | null;
  alterado_por: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      turmas: {
        Row: Turma;
        Insert: Partial<Omit<Turma, "id" | "created_at">> & { nome: string };
        Update: Partial<Omit<Turma, "id" | "created_at">>;
        Relationships: [];
      };
      alunos: {
        Row: Aluno;
        Insert: Partial<Omit<Aluno, "id" | "created_at">> & {
          turma_id: string;
          nome: string;
        };
        Update: Partial<Omit<Aluno, "id" | "created_at">>;
        Relationships: [];
      };
      atividades_colunas: {
        Row: AtividadeColuna;
        Insert: Partial<Omit<AtividadeColuna, "id" | "created_at">> & {
          turma_id: string;
          titulo: string;
        };
        Update: Partial<Omit<AtividadeColuna, "id" | "created_at">>;
        Relationships: [];
      };
      notas_celulas: {
        Row: NotaCelula;
        Insert: Partial<Omit<NotaCelula, "id" | "updated_at">> & {
          aluno_id: string;
          coluna_id: string;
        };
        Update: Partial<Omit<NotaCelula, "id" | "updated_at">>;
        Relationships: [];
      };
      professores: {
        Row: ProfessorComSenha;
        Insert: Partial<Omit<ProfessorComSenha, "id" | "created_at">> & {
          nome: string;
          email: string;
          senha_hash: string;
        };
        Update: Partial<Omit<ProfessorComSenha, "id" | "created_at">>;
        Relationships: [];
      };
      configuracoes: {
        Row: Configuracoes;
        Insert: Partial<Configuracoes>;
        Update: Partial<Omit<Configuracoes, "id">>;
        Relationships: [];
      };
      professor_turma_acesso: {
        Row: ProfessorTurmaAcesso;
        Insert: ProfessorTurmaAcesso;
        Update: Partial<ProfessorTurmaAcesso>;
        Relationships: [];
      };
      notas_historico: {
        Row: NotaHistorico;
        Insert: Partial<Omit<NotaHistorico, "id" | "created_at">> & {
          aluno_id: string;
          coluna_id: string;
        };
        Update: Partial<Omit<NotaHistorico, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
