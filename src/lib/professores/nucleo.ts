import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { gerarSenhaProvisoria } from "@/lib/contas-aluno";
import { ehAdmin } from "@/lib/papeis";
import type { AtorEscola } from "@/lib/simulados/ator";
import type { ProfessorRole } from "@/lib/types";
import { normalizarTelefone, podeAlterarNaTela, podeAlterarProfessor } from "./regras";

/**
 * Núcleo da gestão de professores com quem age explícito (`AtorEscola`): a tela passa o admin logado
 * (via "app") e a Hermes passa o dono na escola do professor (via "hermes"). O alvo precisa ser da
 * escola do ator. Pela Hermes, a conta do dono nunca é alterada (`podeAlterarProfessor`).
 */

export const ERRO_PROFESSOR = "Professor não encontrado.";
const ERRO_TELEFONE_EM_USO = "Esse telefone já está em uso por outro professor.";

type Alvo = { id: string; role: ProfessorRole; escola_id: string };

/** Carrega o professor-alvo e recusa se não for da escola do ator. */
async function alvoDaEscola(ator: AtorEscola, id: string): Promise<Alvo> {
  if (!ehAdmin(ator.role)) throw new Error("Apenas administradores podem fazer isso.");
  const { data: alvo } = await supabase.from("professores").select("id, role, escola_id").eq("id", id).maybeSingle();
  if (!alvo || alvo.escola_id !== ator.escola_id) throw new Error(ERRO_PROFESSOR);
  return alvo as Alvo;
}

/**
 * Alvo da escola + regra do dono: pela Hermes, nunca a conta do dono nem o papel dono; na tela, só o
 * dono mexe em outro dono. `regraDaTela: false` = a tela não confere o dono (telefone, como hoje).
 */
async function exigirAlvo(ator: AtorEscola, id: string, opcoes: { novoPapel?: ProfessorRole; regraDaTela?: boolean } = {}): Promise<Alvo> {
  const alvo = await alvoDaEscola(ator, id);
  const recusa = ator.via === "hermes"
    ? podeAlterarProfessor(alvo.role, opcoes.novoPapel)
    : opcoes.regraDaTela === false ? null : podeAlterarNaTela(ator.role, alvo.role);
  if (recusa) throw new Error(recusa);
  return alvo;
}

export type ConfiguracaoProfessor = { papel?: ProfessorRole; restrito?: boolean; turmas?: string[] };

/**
 * Papel (só pela Hermes: admin ou professor) e acesso às turmas (por nome; `restrito = false` libera
 * todas). Com `restrito`, a lista de turmas liberadas é substituída; as turmas precisam ser da escola.
 */
export async function configurarProfessorPor(ator: AtorEscola, professorId: string, config: ConfiguracaoProfessor): Promise<void> {
  if (config.papel !== undefined && ator.via !== "hermes") throw new Error("Papel inválido.");
  await exigirAlvo(ator, professorId, { novoPapel: config.papel });
  const turmaNomes = config.turmas ?? [];

  if (config.restrito && turmaNomes.length > 0) {
    const { data: turmas, error: erroTurmas } = await supabase.from("turmas").select("nome").eq("escola_id", ator.escola_id);
    if (erroTurmas) throw new Error(erroTurmas.message);
    const nomesDaEscola = new Set((turmas ?? []).map((t) => t.nome));
    if (turmaNomes.some((n) => !nomesDaEscola.has(n))) throw new Error("Turma não encontrada.");
  }

  const campos: { role?: ProfessorRole; acesso_restrito?: boolean } = {};
  if (config.papel !== undefined) campos.role = config.papel;
  if (config.restrito !== undefined) campos.acesso_restrito = config.restrito;
  if (Object.keys(campos).length === 0) return;
  const { error: erroUpdate } = await supabase.from("professores").update(campos).eq("id", professorId);
  if (erroUpdate) throw new Error(erroUpdate.message);

  if (config.restrito === undefined) return;

  const { error: erroDelete } = await supabase.from("professor_turma_acesso").delete().eq("professor_id", professorId);
  if (erroDelete) throw new Error(erroDelete.message);

  if (config.restrito && turmaNomes.length > 0) {
    const { error: erroInsert } = await supabase
      .from("professor_turma_acesso")
      .insert(turmaNomes.map((turma_nome) => ({ professor_id: professorId, turma_nome })));
    if (erroInsert) throw new Error(erroInsert.message);
  }
}

/**
 * Telefone que identifica o professor no agente do Telegram (vazio = remove). Um telefone já usado em
 * outra conta é recusado: o escopo da Hermes procura o professor pelo telefone, que precisa ser único.
 * Devolve o telefone gravado.
 */
export async function telefoneProfessorPor(ator: AtorEscola, professorId: string, telefone: string): Promise<string | null> {
  await exigirAlvo(ator, professorId, { regraDaTela: false });
  const telefoneLimpo = normalizarTelefone(telefone);
  if (telefoneLimpo) {
    const { data: outros, error: erroBusca } = await supabase.from("professores").select("id").eq("telefone", telefoneLimpo).neq("id", professorId).limit(1);
    if (erroBusca) throw new Error(erroBusca.message);
    if ((outros ?? []).length > 0) throw new Error(ERRO_TELEFONE_EM_USO);
  }
  const { error } = await supabase.from("professores").update({ telefone: telefoneLimpo }).eq("id", professorId);
  if (error) {
    if (error.code === "23505") throw new Error(ERRO_TELEFONE_EM_USO);
    throw new Error(error.message);
  }
  return telefoneLimpo;
}

/**
 * Grava uma senha provisória (ativa cadastros pendentes sem depender de e-mail e serve para resetar a
 * senha). O professor é forçado a trocar no próximo login.
 */
export async function definirSenhaProfessorPor(ator: AtorEscola, professorId: string, senha: string): Promise<void> {
  await exigirAlvo(ator, professorId);
  if (senha.length < 6) throw new Error("A senha provisória precisa ter pelo menos 6 caracteres.");
  const senhaHash = await bcrypt.hash(senha, 10);
  const { error } = await supabase
    .from("professores")
    .update({
      senha_hash: senhaHash,
      senha_provisoria: true,
      email_verificado: true,
      token_verificacao: null,
      token_verificacao_expira: null,
    })
    .eq("id", professorId);
  if (error) throw new Error(error.message);
}

/** Gera e grava uma senha provisória nova; devolve a senha (só para a resposta, nunca para o registro). */
export async function senhaProvisoriaProfessorPor(ator: AtorEscola, professorId: string): Promise<string> {
  const senha = gerarSenhaProvisoria();
  await definirSenhaProfessorPor(ator, professorId, senha);
  return senha;
}
