import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { AuthAviso, AuthShell, authBotao } from "@/components/layout/AuthShell";
import { marcaDoEndereco } from "@/lib/marca-servidor";

export const dynamic = "force-dynamic";

type VerificarEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerificarEmailPage({ searchParams }: VerificarEmailPageProps) {
  const marca = await marcaDoEndereco();
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
    if (!sucesso) {
      const { data: aluno } = await supabase
        .from("alunos_contas")
        .select("id, token_verificacao_expira")
        .eq("token_verificacao", token)
        .maybeSingle();

      if (aluno && new Date(aluno.token_verificacao_expira ?? 0) > new Date()) {
        const { error } = await supabase
          .from("alunos_contas")
          .update({ email_verificado: true, token_verificacao: null, token_verificacao_expira: null })
          .eq("id", aluno.id);
        sucesso = !error;
      }
    }
  }

  return (
    <AuthShell marca={marca} titulo={sucesso ? "Email confirmado" : "Link inválido"}>
      {sucesso ? (
        <AuthAviso tipo="ok">Email confirmado! Sua conta já está liberada.</AuthAviso>
      ) : (
        <AuthAviso tipo="erro">Link inválido ou expirado. Faça o cadastro de novo pra receber um novo email.</AuthAviso>
      )}
      <Link href="/login" className={`${authBotao} text-center`}>
        {sucesso ? "Ir para o login" : "Voltar para o login"}
      </Link>
    </AuthShell>
  );
}
