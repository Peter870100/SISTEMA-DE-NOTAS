import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export function bancoQuiz() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("O quiz ainda precisa ser ativado pelo administrador.");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function erroBancoQuiz(erro: { code?: string } | null): Error {
  return new Error(["PGRST205", "42P01", "42501"].includes(erro?.code ?? "")
    ? "O quiz ainda precisa ser ativado pelo administrador."
    : "Não foi possível salvar o quiz. Tente novamente.");
}
