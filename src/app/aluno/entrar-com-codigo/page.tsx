import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthAviso, AuthShell, authBotao, authInput } from "@/components/layout/AuthShell";
import { buscarConviteValido, cadastrarAlunoComCodigo } from "@/actions/contas-aluno";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ codigo?: string; erro?: string; enviado?: string }> };

const MENSAGENS: Record<string, string> = {
  codigo: "Código inválido. Confira com seu professor.",
  campos: "Preencha nome, email e senha.",
  curta: "A senha precisa ter pelo menos 6 caracteres.",
  confirmacao: "A confirmação não bate com a senha.",
  duplicado: "Esse email já tem conta. Entre pela tela de login.",
  falha: "Não foi possível criar a conta. Tente de novo.",
  email: "Não conseguimos enviar o email agora. Tente de novo em alguns minutos.",
};
const rotulo = "flex flex-col gap-1.5 text-xs text-frame-muted";
const linkSecundario = "text-center text-sm text-frame-muted hover:text-white hover:underline";

async function irParaCodigo(formData: FormData) {
  "use server";
  redirect(`/aluno/entrar-com-codigo?codigo=${encodeURIComponent(String(formData.get("codigo") ?? ""))}`);
}

export default async function EntrarComCodigoPage({ searchParams }: Props) {
  const { codigo, erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <AuthShell titulo="Confira seu email" subtitulo="Enviamos um link para confirmar sua conta. Ele vale por 24 horas — veja também a caixa de spam.">
        <Link href="/login" className={`${authBotao} text-center`}>Ir para o login</Link>
      </AuthShell>
    );
  }

  const convite = codigo ? await buscarConviteValido(codigo) : null;

  if (!convite) {
    return (
      <AuthShell titulo="Entrar com código" subtitulo="Digite o código que seu professor passou." comoForm={irParaCodigo}>
        {(erro || codigo) && <AuthAviso tipo="erro">{MENSAGENS.codigo}</AuthAviso>}
        <label className={rotulo}>
          Código da turma
          <input name="codigo" required autoFocus autoCapitalize="characters" placeholder="K7P-4QX" className={`${authInput} font-mono uppercase tracking-widest`} />
        </label>
        <button type="submit" className={`${authBotao} mt-1`}>Continuar</button>
        <Link href="/login" className={linkSecundario}>Já tenho conta</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Criar sua conta" subtitulo={`${convite.escola_nome} · ${convite.turma_nome} · ${convite.ano_letivo}`} comoForm={cadastrarAlunoComCodigo}>
      {erro && <AuthAviso tipo="erro">{MENSAGENS[erro] ?? MENSAGENS.falha}</AuthAviso>}
      <input type="hidden" name="codigo" value={convite.codigo} />
      <label className={rotulo}>Nome completo<input name="nome" required autoComplete="name" className={authInput} /></label>
      <label className={rotulo}>Email<input type="email" name="email" required autoComplete="email" className={authInput} /></label>
      <label className={rotulo}>Senha<input type="password" name="senha" required minLength={6} autoComplete="new-password" className={authInput} /></label>
      <label className={rotulo}>Confirmar senha<input type="password" name="confirmarSenha" required minLength={6} autoComplete="new-password" className={authInput} /></label>
      <button type="submit" className={`${authBotao} mt-1`}>Criar conta</button>
      <Link href="/aluno/entrar-com-codigo" className={linkSecundario}>Não é essa turma? Trocar código</Link>
    </AuthShell>
  );
}
