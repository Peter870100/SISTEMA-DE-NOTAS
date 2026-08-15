import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase/client";
import type { Professor } from "@/lib/types";

export const COOKIE_NOME = "app_auth";

function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Defina AUTH_SECRET.");
  return s;
}

/** Assina o id do professor com AUTH_SECRET — o valor guardado no cookie de sessão. */
export function assinarSessao(professorId: string): string {
  const assinatura = createHmac("sha256", segredo()).update(professorId).digest("hex");
  return `${professorId}.${assinatura}`;
}

/** Valida o cookie de sessão e retorna o id do professor, ou null se inválido/adulterado. */
export function verificarSessao(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [professorId, assinatura] = cookieValue.split(".");
  if (!professorId || !assinatura) return null;

  const esperada = createHmac("sha256", segredo()).update(professorId).digest("hex");
  const bufAssinatura = Buffer.from(assinatura);
  const bufEsperada = Buffer.from(esperada);
  if (bufAssinatura.length !== bufEsperada.length || !timingSafeEqual(bufAssinatura, bufEsperada)) {
    return null;
  }
  return professorId;
}

const THROTTLE_ULTIMO_ACESSO_MS = 60_000;

/** Professor logado na requisição atual (via cookie), ou null se não autenticado. */
export async function getProfessorAtual(): Promise<Professor | null> {
  const cookieStore = await cookies();
  const professorId = verificarSessao(cookieStore.get(COOKIE_NOME)?.value);
  if (!professorId) return null;

  const { data } = await supabase
    .from("professores")
    .select(
      "id, nome, email, role, email_verificado, senha_provisoria, acesso_restrito, telefone, ultimo_acesso, created_at"
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
