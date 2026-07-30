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

/** Professor logado na requisição atual (via cookie), ou null se não autenticado. */
export async function getProfessorAtual(): Promise<Professor | null> {
  const cookieStore = await cookies();
  const professorId = verificarSessao(cookieStore.get(COOKIE_NOME)?.value);
  if (!professorId) return null;

  const { data } = await supabase
    .from("professores")
    .select("id, nome, email, role, created_at")
    .eq("id", professorId)
    .maybeSingle();
  return data ?? null;
}
