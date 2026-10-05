import { createClient } from "@supabase/supabase-js";
import { BUCKET_CAPAS } from "./capas";
/** Somente ações e utilitários do servidor importam este módulo. */
export function armazenamentoCapas() {
  if (typeof window !== "undefined") throw new Error("Armazenamento disponível apenas no servidor.");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("O envio de imagens ainda não está disponível. Peça ao administrador para concluir a configuração.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET_CAPAS);
}
