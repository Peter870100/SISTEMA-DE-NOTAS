import Link from "next/link";
import { redefinirSenha } from "@/actions/auth";
import { contaDoTokenRedefinicao } from "@/lib/auth";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

export const dynamic = "force-dynamic";

type RedefinirSenhaPageProps = {
  searchParams: Promise<{ token?: string; erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  curta: "A nova senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a nova senha.",
  falha: "Não foi possível salvar a senha. Tente novamente.",
};

const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";

export default async function RedefinirSenhaPage({ searchParams }: RedefinirSenhaPageProps) {
  const { token, erro } = await searchParams;

  if (erro === "link" || !(await contaDoTokenRedefinicao(token))) {
    return (
      <AuthShell titulo="Link inválido">
        <AuthAviso tipo="erro">
          Esse link expirou ou já foi usado. Peça um novo pra redefinir sua senha.
        </AuthAviso>
        <Link href="/esqueci-senha" className={`${authBotao} text-center`}>
          Pedir novo link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Criar nova senha" subtitulo="Escolha a nova senha da sua conta." comoForm={redefinirSenha}>
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível salvar a senha."}</AuthAviso>}
      <input type="hidden" name="token" value={token} />
      <label className={rotulo}>
        Nova senha
        <input type="password" name="novaSenha" required minLength={6} autoFocus autoComplete="new-password" className={authInput} />
      </label>
      <label className={rotulo}>
        Confirmar nova senha
        <input type="password" name="confirmarSenha" required minLength={6} autoComplete="new-password" className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>
        Salvar nova senha
      </button>
    </AuthShell>
  );
}
