import Link from "next/link";
import { login } from "@/actions/auth";
import { obterEscolaPorSlug } from "@/lib/escolas";
import { urlDaEscola } from "@/lib/dominio";
import { AuthAviso, authBotao, authInput } from "@/components/layout/AuthShell";

import { LoginShell } from "@/components/layout/LoginShell";
import { marcaDoEndereco } from "@/lib/marca-servidor";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string; escola?: string; "senha-redefinida"?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "1": "Email, usuário ou senha incorretos. Tente novamente.",
  "nao-verificado": "Confirme seu email antes de entrar — veja sua caixa de entrada.",
  bloqueado: "Sua conta está bloqueada. Fale com a sua escola.",
  suspenso: "Acesso suspenso. Fale com a plataforma.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const marca = await marcaDoEndereco();
  const { erro, escola: escolaParam, "senha-redefinida": senhaRedefinida } = await searchParams;
  // O parâmetro é só um slug a validar; o link sai da escola encontrada.
  const outraEscola = erro === "outra-escola" && escolaParam ? await obterEscolaPorSlug(escolaParam) : null;

  return (
    <LoginShell marca={marca} action={login}>
      {senhaRedefinida && !erro && <AuthAviso tipo="ok">Senha alterada! Entre com a nova senha.</AuthAviso>}
      {erro && erro !== "outra-escola" && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível entrar. Tente novamente."}</AuthAviso>}
      {erro === "outra-escola" && !outraEscola && <AuthAviso tipo="erro">Não foi possível entrar. Tente novamente.</AuthAviso>}
      {outraEscola && (
        <AuthAviso tipo="erro">
          Sua conta é da {outraEscola.nome}.{" "}
          <a href={urlDaEscola(outraEscola.slug, "/login")} className="font-semibold underline">
            Entrar no endereço da {outraEscola.nome}
          </a>
        </AuthAviso>
      )}
      <label className="flex flex-col gap-2 text-sm text-frame-muted">
        Email ou usuário
        <input type="text" name="identificador" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="seu.email@exemplo.com ou joao.silva" className={`${authInput} min-h-12`} />
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
      <Link href="/aluno/entrar-com-codigo" className="text-center text-sm text-frame-muted hover:text-white hover:underline">
        Sou aluno e tenho um código
      </Link>
    </LoginShell>
  );
}
