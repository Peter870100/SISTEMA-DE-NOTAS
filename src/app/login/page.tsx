import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "1": "Email ou senha incorretos. Tente novamente.",
  "nao-verificado": "Confirme seu email antes de entrar — veja sua caixa de entrada.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erro } = await searchParams;

  return (
    <AuthShell titulo="Bem-vindo de volta" subtitulo="Entre para lançar as notas das suas turmas." comoForm={login}>
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}</AuthAviso>}
      <label className="flex flex-col gap-1.5 text-xs text-frame-muted">
        Email
        <input type="email" name="email" autoFocus autoComplete="email" className={authInput} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-frame-muted">
        Senha
        <input type="password" name="senha" autoComplete="current-password" className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>Entrar →</button>
      <Link href="/cadastro" className="text-center text-sm text-frame-muted hover:text-white hover:underline">
        Não tem conta? Cadastre-se
      </Link>
    </AuthShell>
  );
}
