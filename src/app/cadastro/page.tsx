import Link from "next/link";
import { cadastrar } from "@/actions/cadastro";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type CadastroPageProps = {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  codigo: "Código de convite inválido.",
  campos: "Preencha nome, email e senha.",
  duplicado: "Esse email já tem uma conta confirmada. Tente entrar em vez de se cadastrar.",
  falha: "Não foi possível criar a conta. Tente novamente.",
  email: "Conta criada, mas não conseguimos enviar o email de confirmação. Tente se cadastrar de novo.",
};

const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";
const linkSecundario = "text-center text-sm text-frame-muted hover:text-white hover:underline";

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const { erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <AuthShell videoCadastro
        titulo="Quase lá!"
        subtitulo="Enviamos um email de confirmação. Clique no link que chegou na sua caixa de entrada pra ativar sua conta."
      >
        <Link href="/login" className={`${authBotao} text-center`}>
          Voltar para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell videoCadastro
      titulo="Criar conta"
      subtitulo="Peça o código de convite pra quem administra o sistema."
      comoForm={cadastrar}
    >
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível criar a conta."}</AuthAviso>}
      <label className={rotulo}>
        Nome
        <input name="nome" autoFocus autoComplete="name" className={authInput} />
      </label>
      <label className={rotulo}>
        Email
        <input type="email" name="email" autoComplete="email" className={authInput} />
      </label>
      <label className={rotulo}>
        Senha
        <input type="password" name="senha" autoComplete="new-password" className={authInput} />
      </label>
      <label className={rotulo}>
        Código de convite
        <input name="codigo" inputMode="numeric" className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>
        Criar conta
      </button>
      <Link href="/login" className={linkSecundario}>
        Já tenho conta
      </Link>
    </AuthShell>
  );
}
