import Link from "next/link";
import { pedirRedefinicaoSenha } from "@/actions/auth";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type EsqueciSenhaPageProps = {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  campos: "Informe o email da sua conta.",
  email: "Não conseguimos enviar o email agora. Tente de novo em alguns minutos.",
};

const linkSecundario = "text-center text-sm text-frame-muted hover:text-white hover:underline";

export default async function EsqueciSenhaPage({ searchParams }: EsqueciSenhaPageProps) {
  const { erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <AuthShell
        titulo="Confira seu email"
        subtitulo="Se esse email tiver uma conta, enviamos um link pra redefinir a senha. Ele vale por 1 hora — veja também a caixa de spam."
      >
        <Link href="/login" className={`${authBotao} text-center`}>
          Voltar para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Esqueci minha senha"
      subtitulo="Informe o email da sua conta e enviaremos um link pra você criar uma senha nova."
      comoForm={pedirRedefinicaoSenha}
    >
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível enviar o link."}</AuthAviso>}
      <label className="flex flex-col gap-1.5 text-xs text-frame-muted">
        Email
        <input type="email" name="email" required autoFocus autoComplete="email" className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>
        Enviar link
      </button>
      <Link href="/login" className={linkSecundario}>
        Lembrei a senha
      </Link>
    </AuthShell>
  );
}
