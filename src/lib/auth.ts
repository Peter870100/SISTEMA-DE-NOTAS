import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase/client";
import type { Professor } from "@/lib/types";
import { segredo, verificarSessao, type Sessao } from "@/lib/sessao";
import { contaDoToken, validarTokenRedefinicao } from "@/lib/token-senha";

export { segredo } from "@/lib/sessao";

export const COOKIE_NOME = "app_auth";

/** Conta (professor ou aluno) dona de um link de "esqueci minha senha" ainda válido, ou null. */
export async function contaDoTokenRedefinicao(token: string | undefined): Promise<Sessao | null> {
  const conta = contaDoToken(token);
  if (!token || !conta) return null;
  const tabela = conta.tipo === "a" ? "alunos_contas" : "professores";
  const { data } = await supabase.from(tabela).select("senha_hash").eq("id", conta.id).maybeSingle();
  return validarTokenRedefinicao(token, data?.senha_hash ?? null, segredo());
}

const THROTTLE_ULTIMO_ACESSO_MS = 60_000;

/** Professor logado na requisição atual (via cookie), ou null se não autenticado. */
export async function getProfessorAtual(): Promise<Professor | null> {
  const cookieStore = await cookies();
  const sessao = verificarSessao(cookieStore.get(COOKIE_NOME)?.value, segredo());
  if (!sessao || sessao.tipo !== "p") return null;
  const professorId = sessao.id;

  const { data } = await supabase
    .from("professores")
    .select(
      "id, nome, email, role, escola_id, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
    )
    .eq("id", professorId)
    .maybeSingle();
  if (!data) return null;

  const desatualizado =
    !data.ultimo_acesso || Date.now() - new Date(data.ultimo_acesso).getTime() > THROTTLE_ULTIMO_ACESSO_MS;
  if (desatualizado) {
    const agora = new Date().toISOString();
    await supabase.from("professores").update({ ultimo_acesso: agora }).eq("id", professorId);
    data.ultimo_acesso = agora;
  }

  return data;
}

/** Lança erro se o professor logado não existir ou não for admin. */
export async function exigirAdmin(): Promise<void> {
  const atual = await getProfessorAtual();
  if (!atual || atual.role !== "admin") {
    throw new Error("Apenas administradores podem fazer isso.");
  }
}

/**
 * Nomes de turma liberados pro professor, ou null se ele enxerga todas (admin, ou
 * `acesso_restrito` desligado — o padrão pra quem já existia antes dessa trava existir).
 */
export async function turmasLiberadasPara(professor: Professor): Promise<Set<string> | null> {
  if (professor.role === "admin" || !professor.acesso_restrito) return null;
  const { data } = await supabase
    .from("professor_turma_acesso")
    .select("turma_nome")
    .eq("professor_id", professor.id);
  return new Set((data ?? []).map((r) => r.turma_nome));
}

/** True se o professor pode acessar uma turma com esse nome (admin ou sem restrição sempre pode). */
export async function professorTemAcessoATurma(professor: Professor, turmaNome: string): Promise<boolean> {
  const liberadas = await turmasLiberadasPara(professor);
  return liberadas === null || liberadas.has(turmaNome);
}

/**
 * Lança erro se houver um professor logado (requisição anônima direta passa —
 * mesmo modelo permissivo de `upsertCelula`) e ele não tiver acesso à turma do id dado.
 * Usar em toda Server Action que mexe em dado de uma turma específica.
 */
export async function exigirAcessoATurmaId(
  professor: Professor | null,
  turmaId: string
): Promise<void> {
  if (!professor) return;
  const { data: turma } = await supabase.from("turmas").select("nome").eq("id", turmaId).single();
  if (!turma || !(await professorTemAcessoATurma(professor, turma.nome))) {
    throw new Error("Você não tem acesso a essa turma.");
  }
}
