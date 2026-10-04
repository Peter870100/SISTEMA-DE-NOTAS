export type Turma = {
  id: string;
  nome: string;
  bimestre: string;
  ano_letivo: string;
  escola_id: string;
  criado_via: OrigemRegistro;
  created_at: string;
};

export type Aluno = {
  id: string;
  turma_id: string;
  numero: number | null;
  nome: string;
  ordem: number;
  nome_editado_em: string | null;
  transferido_em: string | null;
  criado_via: OrigemRegistro;
  created_at: string;
};

export type TipoColuna = "nota" | "presenca";

/** Quem criou/excluiu: a tela do sistema ou o agente de IA (Hermes, via MCP). */
export type OrigemRegistro = "app" | "hermes";

export type AtividadeColuna = {
  id: string;
  turma_id: string;
  titulo: string;
  tema: string | null;
  peso: number;
  tipo: TipoColuna;
  ordem: number;
  criado_via: OrigemRegistro;
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

export type ProfessorRole = "dono" | "admin" | "professor";

export type Professor = {
  id: string;
  nome: string;
  email: string;
  role: ProfessorRole;
  escola_id: string;
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

export type TipoLixeira = "turma" | "aluno" | "atividade";

export type ResumoLixeira = { alunos?: number; atividades?: number; notas?: number };

/** Linha da lixeira sem a cópia (`dados`), que é pesada e só a função de restaurar usa. */
export type ItemLixeira = {
  id: string;
  tipo: TipoLixeira;
  titulo: string;
  turma_id: string | null;
  turma_nome: string | null;
  resumo: ResumoLixeira;
  excluido_por: string | null;
  excluido_via: OrigemRegistro;
  excluido_em: string;
};

export type ResultadoRestauracao = {
  tipo: TipoLixeira;
  turma_id: string | null;
  notas_restauradas: number;
  notas_puladas: number;
};

export type Escola = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string;
  cor_principal: string | null;
  cor_destaque: string | null;
  slogan: string | null;
  foto_login_url: string | null;
  nome_remetente_email: string;
  codigo_convite_professor: string;
  created_at: string;
};

export type OrigemContaAluno = "escola" | "convite";

export type AlunoConta = {
  id: string;
  escola_id: string;
  nome: string;
  email: string | null;
  usuario: string | null;
  senha_provisoria: boolean;
  email_verificado: boolean;
  ativo: boolean;
  criado_via: OrigemContaAluno;
  ultimo_acesso: string | null;
  created_at: string;
};

/** Linha crua de alunos_contas (com hash e token) — só em actions server-side. */
export type AlunoContaComSenha = AlunoConta & {
  senha_hash: string;
  token_verificacao: string | null;
  token_verificacao_expira: string | null;
};

export type AlunoTurma = {
  conta_id: string;
  escola_id: string;
  turma_nome: string;
  ano_letivo: string;
  aluno_id: string | null;
  created_at: string;
};

export type ConviteTurma = {
  id: string;
  codigo: string;
  escola_id: string;
  turma_nome: string;
  ano_letivo: string;
  criado_por: string | null;
  expira_em: string | null;
  ativo: boolean;
  usos: number;
  created_at: string;
};

export type ProvedorVideo = "youtube" | "bunny";
export type RegraGabarito = "junto" | "apos_concluir" | "data";
export type TipoArquivoAula = "material" | "gabarito";

export type Curso = {
  id: string;
  escola_id: string;
  professor_id: string | null;
  titulo: string;
  disciplina: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
};

export type CursoTurma = { curso_id: string; escola_id: string; turma_nome: string; ano_letivo: string };

export type Modulo = { id: string; curso_id: string; titulo: string; ordem: number; created_at: string };

export type Aula = {
  id: string;
  modulo_id: string;
  curso_id: string;
  titulo: string;
  texto: string | null;
  video_provedor: ProvedorVideo | null;
  video_id: string | null;
  publicada: boolean;
  publicada_em: string | null;
  gabarito_liberacao: RegraGabarito;
  gabarito_libera_em: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type AulaArquivo = {
  id: string;
  aula_id: string;
  tipo: TipoArquivoAula;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number;
  created_at: string;
};

export type AulaProgresso = {
  conta_id: string;
  aula_id: string;
  curso_id: string;
  posicao_seg: number;
  maior_posicao_seg: number;
  duracao_seg: number | null;
  concluida_em: string | null;
  atualizado_em: string;
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
      lixeira: {
        Row: ItemLixeira & { dados: unknown };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      escolas: {
        Row: Escola;
        Insert: Partial<Omit<Escola, "id" | "created_at">> & {
          nome: string;
          slug: string;
          logo_url: string;
          nome_remetente_email: string;
          codigo_convite_professor: string;
        };
        Update: Partial<Omit<Escola, "id" | "created_at">>;
        Relationships: [];
      };
      alunos_contas: {
        Row: AlunoContaComSenha;
        Insert: Partial<Omit<AlunoContaComSenha, "id" | "created_at">> & {
          escola_id: string;
          nome: string;
          senha_hash: string;
          criado_via: OrigemContaAluno;
        };
        Update: Partial<Omit<AlunoContaComSenha, "id" | "created_at">>;
        Relationships: [];
      };
      aluno_turmas: {
        Row: AlunoTurma;
        Insert: Omit<AlunoTurma, "created_at" | "aluno_id"> & { aluno_id?: string | null };
        Update: Partial<Omit<AlunoTurma, "created_at">>;
        Relationships: [];
      };
      convites_turma: {
        Row: ConviteTurma;
        Insert: Partial<Omit<ConviteTurma, "id" | "created_at">> & {
          codigo: string;
          escola_id: string;
          turma_nome: string;
          ano_letivo: string;
        };
        Update: Partial<Omit<ConviteTurma, "id" | "created_at">>;
        Relationships: [];
      };
      cursos: {
        Row: Curso;
        Insert: Partial<Omit<Curso, "id" | "created_at" | "updated_at">> & { escola_id: string; titulo: string; disciplina: string };
        Update: Partial<Omit<Curso, "id" | "created_at">>;
        Relationships: [];
      };
      curso_turmas: {
        Row: CursoTurma;
        Insert: CursoTurma;
        Update: Partial<CursoTurma>;
        Relationships: [];
      };
      modulos: {
        Row: Modulo;
        Insert: Partial<Omit<Modulo, "id" | "created_at">> & { curso_id: string; titulo: string };
        Update: Partial<Omit<Modulo, "id" | "created_at">>;
        Relationships: [];
      };
      aulas: {
        Row: Aula;
        Insert: Partial<Omit<Aula, "id" | "created_at" | "updated_at">> & { modulo_id: string; curso_id: string; titulo: string };
        Update: Partial<Omit<Aula, "id" | "created_at">>;
        Relationships: [];
      };
      aula_arquivos: {
        Row: AulaArquivo;
        Insert: Omit<AulaArquivo, "id" | "created_at">;
        Update: Partial<Omit<AulaArquivo, "id" | "created_at">>;
        Relationships: [];
      };
      aula_progresso: {
        Row: AulaProgresso;
        Insert: Partial<AulaProgresso> & { conta_id: string; aula_id: string; curso_id: string };
        Update: Partial<AulaProgresso>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      lixeira_excluir: {
        Args: { p_tipo: TipoLixeira; p_id: string; p_ator?: string | null; p_via?: OrigemRegistro };
        Returns: string;
      };
      lixeira_restaurar: {
        Args: { p_lixeira_id: string };
        Returns: ResultadoRestauracao;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
