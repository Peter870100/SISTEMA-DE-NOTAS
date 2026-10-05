import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { trocarSenhaAluno } from "@/actions/auth";
import { marcaDaConta } from "@/lib/marca-servidor";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";

type AlunoTrocarSenhaPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

const MENSAGENS_ERRO: Record<string, string> = {
  "senha-atual": "Senha atual incorreta.",
  curta: "A nova senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a nova senha.",
  falha: "Não foi possível trocar a senha. Tente novamente.",
};

export default async function AlunoTrocarSenhaPage({ searchParams }: AlunoTrocarSenhaPageProps) {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const marca = await marcaDaConta(aluno.escola_id);

  const { erro } = await searchParams;

  const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";

  return (
    <AuthShell marca={marca}
      titulo="Trocar senha"
      subtitulo={
        aluno.senha_provisoria
          ? "Crie uma senha sua para continuar. A senha que a escola passou é provisória."
          : "Escolha uma nova senha pra sua conta."
      }
      comoForm={trocarSenhaAluno}
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
