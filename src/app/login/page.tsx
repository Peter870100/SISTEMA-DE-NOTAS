import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthAviso, authBotao, authInput } from "@/components/layout/AuthShell";

import { LoginShell } from "@/components/layout/LoginShell";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string; "senha-redefinida"?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "1": "Email ou senha incorretos. Tente novamente.",
  "nao-verificado": "Confirme seu email antes de entrar — veja sua caixa de entrada.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erro, "senha-redefinida": senhaRedefinida } = await searchParams;

  return (
    <LoginShell action={login}>
      {senhaRedefinida && !erro && <AuthAviso tipo="ok">Senha alterada! Entre com a nova senha.</AuthAviso>}
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}</AuthAviso>}
      <label className="flex flex-col gap-2 text-sm text-frame-muted">
        Email
        <input type="email" name="email" required autoComplete="email" placeholder="seu.email@exemplo.com" className={`${authInput} min-h-12`} />
      </label>
      <label className="flex flex-col gap-2 text-sm text-frame-muted">
        <span className="flex flex-wrap items-center justify-between gap-2">
          Senha
          <Link href="/esqueci-senha" className="text-frame-muted hover:text-white hover:underline">
            Esqueci minha senha
          </Link>
        </span>
        <input type="password" name="senha" required autoComplete="current-password" placeholder="Digite sua senha" className={`${authInput} min-h-12`} />
      </label>
      <button type="submit" className={`${authBotao} mt-1 min-h-12 active:scale-[0.98]`}>Entrar no portal →</button>
      <Link href="/cadastro" className="text-center text-sm text-frame-muted hover:text-white hover:underline">
        Não tem conta? Cadastre-se
      </Link>
    </LoginShell>
  );
}
