import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { trocarSenha } from "@/actions/auth";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type TrocarSenhaPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "senha-atual": "Senha atual incorreta.",
  curta: "A nova senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a nova senha.",
  falha: "Não foi possível trocar a senha. Tente novamente.",
};

export default async function TrocarSenhaPage({ searchParams }: TrocarSenhaPageProps) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  const { erro } = await searchParams;

  const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";

  return (
    <AuthShell
      titulo="Trocar senha"
      subtitulo={
        professor.senha_provisoria
          ? "Sua senha foi definida por um administrador. Escolha uma nova senha pra continuar."
          : "Escolha uma nova senha pra sua conta."
      }
      comoForm={trocarSenha}
    >
      {erro && <AuthAviso tipo="erro">{MENSAGENS_ERRO[erro] ?? "Não foi possível trocar a senha."}</AuthAviso>}
      <label className={rotulo}>
        Senha atual
        <input type="password" name="senhaAtual" autoFocus autoComplete="current-password" className={authInput} />
      </label>
      <label className={rotulo}>
        Nova senha
        <input type="password" name="novaSenha" autoComplete="new-password" className={authInput} />
      </label>
      <label className={rotulo}>
        Confirmar nova senha
        <input type="password" name="confirmarSenha" autoComplete="new-password" className={authInput} />
      </label>
      <button type="submit" className={`${authBotao} mt-1`}>
        Trocar senha
      </button>
    </AuthShell>
  );
}
