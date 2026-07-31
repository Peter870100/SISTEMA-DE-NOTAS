import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type VerificarEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerificarEmailPage({ searchParams }: VerificarEmailPageProps) {
  const { token } = await searchParams;

  let sucesso = false;
  if (token) {
    const { data: professor } = await supabase
      .from("professores")
      .select("id, token_verificacao_expira")
      .eq("token_verificacao", token)
      .maybeSingle();

    if (professor && new Date(professor.token_verificacao_expira ?? 0) > new Date()) {
      const { error } = await supabase
        .from("professores")
        .update({ email_verificado: true, token_verificacao: null, token_verificacao_expira: null })
        .eq("id", professor.id);
      sucesso = !error;
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Planilha Viva</h1>
        {sucesso ? (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Email confirmado! Sua conta já está liberada.
          </p>
        ) : (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Link inválido ou expirado. Cadastre-se novamente pra receber um novo email.
          </p>
        )}
        <Link
          href={sucesso ? "/login" : "/cadastro"}
          className="mt-4 inline-block w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700"
        >
          {sucesso ? "Ir para o login" : "Cadastrar novamente"}
        </Link>
      </div>
    </main>
  );
}
