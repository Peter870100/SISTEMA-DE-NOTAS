/**
 * Consulta livre da Hermes (só perfil dono): estruturada e só de leitura.
 * A Hermes escolhe tabela, colunas e filtros desta lista fixa; nenhum SQL vem dela.
 * Colunas com senha, token ou código de convite NUNCA entram aqui (fonte: db/schema.sql).
 */
export const TABELAS_LIVRES: Readonly<Record<string, readonly string[]>> = {
  // sem codigo_convite_professor
  escolas: ["id", "nome", "slug", "logo_url", "cor_principal", "cor_destaque", "slogan", "foto_login_url", "nome_remetente_email", "ativa", "created_at"],
  // sem senha_hash, token_verificacao, token_verificacao_expira
  professores: ["id", "escola_id", "nome", "email", "role", "email_verificado", "senha_provisoria", "acesso_restrito", "telefone", "ultimo_acesso", "created_at"],
  professor_turma_acesso: ["professor_id", "turma_nome"],
  turmas: ["id", "escola_id", "nome", "bimestre", "ano_letivo", "bimestre_encerrado", "bimestre_vigente", "criado_via", "created_at"],
  alunos: ["id", "turma_id", "numero", "nome", "ordem", "nome_editado_em", "transferido_em", "criado_via", "created_at"],
  atividades_colunas: ["id", "turma_id", "titulo", "tema", "peso", "tipo", "ordem", "criado_via", "created_at"],
  notas_celulas: ["id", "aluno_id", "coluna_id", "valor", "status_texto", "atualizado_por", "updated_at"],
  notas_historico: ["id", "aluno_id", "coluna_id", "valor_anterior", "status_anterior", "valor_novo", "status_novo", "alterado_por", "created_at"],
  // sem senha_hash, token_verificacao, token_verificacao_expira e sem avatar_perfil (foto em base64)
  alunos_contas: ["id", "escola_id", "nome", "email", "usuario", "senha_provisoria", "email_verificado", "ativo", "criado_via", "ultimo_acesso", "created_at"],
  aluno_turmas: ["conta_id", "escola_id", "turma_nome", "ano_letivo", "aluno_id", "created_at"],
  cursos: ["id", "escola_id", "professor_id", "titulo", "disciplina", "descricao", "capa_caminho", "created_at", "updated_at"],
  curso_turmas: ["curso_id", "escola_id", "turma_nome", "ano_letivo"],
  modulos: ["id", "curso_id", "titulo", "ordem", "created_at"],
  aulas: ["id", "modulo_id", "curso_id", "titulo", "texto", "video_provedor", "video_id", "publicada", "publicada_em", "gabarito_liberacao", "gabarito_libera_em", "ordem", "duracao_seg", "capa_caminho", "created_at", "updated_at"],
  aula_progresso: ["conta_id", "aula_id", "curso_id", "posicao_seg", "maior_posicao_seg", "duracao_seg", "concluida_em", "atualizado_em", "tempo_assistido_seg", "saidas", "tempo_fora_seg"],
  assuntos: ["id", "materia", "nome", "situacao", "created_at"],
  importacoes: ["id", "escopo", "escola_id", "origem", "banca", "ano", "caderno", "status", "total_paginas", "paginas_lidas", "batch_id", "custo_estimado_usd", "custo_real_usd", "erro", "criado_por", "created_at", "updated_at"],
  questoes: ["id", "escopo", "escola_id", "banca", "ano", "caderno", "numero", "area", "materia", "assunto_id", "enunciado", "comando", "alternativas", "resposta", "anulada", "status", "precisa_revisao", "motivo_revisao", "origem", "importacao_id", "pagina_id", "fonte_id", "criado_por", "created_at", "updated_at"],
  simulados: ["id", "escola_id", "tipo", "professor_id", "conta_id", "titulo", "duracao_min", "abre_em", "fecha_em", "correcao", "embaralhar", "status", "created_at", "updated_at"],
  simulado_turmas: ["simulado_id", "escola_id", "turma_nome", "ano_letivo"],
  simulado_questoes: ["simulado_id", "questao_id", "ordem"],
  tentativas: ["id", "simulado_id", "conta_id", "ordem", "iniciada_em", "prazo_em", "tempo_usado_seg", "ultimo_pulso_em", "entregue_em", "status", "acertos", "total", "porcentagem", "por_area", "tempo_questoes", "saidas", "tempo_fora_seg", "eventos_saida", "created_at"],
  tentativa_respostas: ["tentativa_id", "questao_id", "alternativa", "respondida_em", "correta"],
};

export const OPERACOES_LIVRES = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is_null", "not_null"] as const;
export type OperacaoLivre = (typeof OPERACOES_LIVRES)[number];

type Primitivo = string | number | boolean;
export type FiltroLivre = { coluna: string; op: OperacaoLivre; valor?: Primitivo | Primitivo[] };
export type ConsultaLivreValida = {
  tabela: string;
  colunas: string[];
  filtros: FiltroLivre[];
  ordem: { coluna: string; asc: boolean } | null;
  limite: number;
};
export type EntradaConsultaLivre = {
  tabela: string;
  colunas?: string[];
  filtros?: { coluna: string; op: string; valor?: unknown }[];
  ordem?: { coluna: string; asc?: boolean };
  limite?: number;
};

export const LIMITE_PADRAO = 100;
export const LIMITE_MAXIMO = 500;
const MAX_FILTROS = 20;
const MAX_ITENS_IN = 500;
const MAX_TEXTO = 500;

function ehPrimitivo(v: unknown): v is Primitivo {
  if (typeof v === "string") return v.length <= MAX_TEXTO;
  return typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
}

/** Confere a consulta contra a lista fixa. Devolve a consulta pronta ou o erro em pt-BR. */
export function validarConsultaLivre(entrada: EntradaConsultaLivre): ConsultaLivreValida | { erro: string } {
  const tabela = entrada.tabela;
  if (typeof tabela !== "string" || !Object.prototype.hasOwnProperty.call(TABELAS_LIVRES, tabela)) {
    return { erro: `Tabela "${tabela}" não pode ser consultada. Tabelas permitidas: ${Object.keys(TABELAS_LIVRES).join(", ")}.` };
  }
  const permitidas = TABELAS_LIVRES[tabela];
  const colunaOk = (c: unknown): c is string => typeof c === "string" && permitidas.includes(c);
  const erroColuna = (c: unknown) => ({ erro: `Coluna "${String(c)}" não pode ser consultada na tabela ${tabela}. Colunas permitidas: ${permitidas.join(", ")}.` });

  let colunas: string[];
  if (entrada.colunas === undefined || entrada.colunas.length === 0) colunas = [...permitidas];
  else {
    for (const c of entrada.colunas) if (!colunaOk(c)) return erroColuna(c);
    colunas = [...new Set(entrada.colunas)];
  }

  const filtros: FiltroLivre[] = [];
  const brutos = entrada.filtros ?? [];
  if (brutos.length > MAX_FILTROS) return { erro: `No máximo ${MAX_FILTROS} filtros por consulta.` };
  for (const f of brutos) {
    if (!colunaOk(f.coluna)) return erroColuna(f.coluna);
    if (!(OPERACOES_LIVRES as readonly string[]).includes(f.op)) {
      return { erro: `Operação "${f.op}" inválida. Use uma destas: ${OPERACOES_LIVRES.join(", ")}.` };
    }
    const op = f.op as OperacaoLivre;
    if (op === "is_null" || op === "not_null") {
      filtros.push({ coluna: f.coluna, op });
      continue;
    }
    if (op === "in") {
      const v = f.valor;
      if (!Array.isArray(v) || v.length === 0 || v.length > MAX_ITENS_IN || !v.every(ehPrimitivo)) {
        return { erro: `O filtro "in" em "${f.coluna}" precisa de uma lista com 1 a ${MAX_ITENS_IN} valores simples (texto, número ou verdadeiro/falso).` };
      }
      // O supabase-js põe aspas em valores com vírgula/parênteses, mas não escapa aspas nem barra invertida.
      if (v.some((x) => typeof x === "string" && /["\\]/.test(x))) {
        return { erro: `Valores do filtro "in" em "${f.coluna}" não podem conter aspas (") nem barra invertida (\\).` };
      }
      filtros.push({ coluna: f.coluna, op, valor: v });
      continue;
    }
    if (!ehPrimitivo(f.valor)) {
      return { erro: `O filtro "${op}" em "${f.coluna}" precisa de um valor simples (texto de até ${MAX_TEXTO} caracteres, número ou verdadeiro/falso).` };
    }
    if (op === "ilike" && typeof f.valor !== "string") return { erro: `O filtro "ilike" em "${f.coluna}" precisa de um texto.` };
    filtros.push({ coluna: f.coluna, op, valor: f.valor });
  }

  let ordem: ConsultaLivreValida["ordem"] = null;
  if (entrada.ordem) {
    if (!colunaOk(entrada.ordem.coluna)) return erroColuna(entrada.ordem.coluna);
    ordem = { coluna: entrada.ordem.coluna, asc: entrada.ordem.asc !== false };
  }

  const limite = entrada.limite ?? LIMITE_PADRAO;
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
    return { erro: `Limite deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.` };
  }

  return { tabela, colunas, filtros, ordem, limite };
}
