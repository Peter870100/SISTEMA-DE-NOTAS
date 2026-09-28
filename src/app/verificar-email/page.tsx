import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { AuthAviso, AuthShell, authBotao } from "@/components/layout/AuthShell";

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
    <AuthShell titulo={sucesso ? "Email confirmado" : "Link inválido"}>
      {sucesso ? (
        <AuthAviso tipo="ok">Email confirmado! Sua conta já está liberada.</AuthAviso>
      ) : (
        <AuthAviso tipo="erro">Link inválido ou expirado. Cadastre-se novamente pra receber um novo email.</AuthAviso>
      )}
      <Link href={sucesso ? "/login" : "/cadastro"} className={`${authBotao} text-center`}>
        {sucesso ? "Ir para o login" : "Cadastrar novamente"}
      </Link>
    </AuthShell>
  );
}
