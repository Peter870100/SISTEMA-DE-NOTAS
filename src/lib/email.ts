import { Resend } from "resend";

export type MarcaEmail = { nome: string; nome_remetente_email: string };

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Defina RESEND_API_KEY.");
  return new Resend(key);
}

export async function enviarEmailVerificacao(
  destinatario: string,
  nome: string,
  link: string,
  escola: MarcaEmail
): Promise<void> {
  const { error } = await client().emails.send({
    from: `${escola.nome_remetente_email} <onboarding@resend.dev>`,
    to: destinatario,
    subject: `Confirme seu email — ${escola.nome}`,
    html: `
      <p>Olá, ${escaparHtml(nome)}!</p>
      <p>Confirme seu email pra ativar sua conta no ${escaparHtml(escola.nome)}:</p>
      <p><a href="${escaparHtml(link)}">${escaparHtml(link)}</a></p>
      <p>Esse link expira em 24 horas. Se você não pediu esse cadastro, pode ignorar este email.</p>
    `,
  });
  if (error) throw new Error(error.message);
}

export async function enviarEmailRedefinicaoSenha(
  destinatario: string,
  nome: string,
  link: string,
  escola: MarcaEmail
): Promise<void> {
  const { error } = await client().emails.send({
    from: `${escola.nome_remetente_email} <onboarding@resend.dev>`,
    to: destinatario,
    subject: `Redefinir sua senha — ${escola.nome}`,
    html: `
      <p>Olá, ${escaparHtml(nome)}!</p>
      <p>Recebemos um pedido pra redefinir a senha da sua conta no ${escaparHtml(escola.nome)}. Clique no link pra escolher uma nova:</p>
      <p><a href="${escaparHtml(link)}">${escaparHtml(link)}</a></p>
      <p>Esse link expira em 1 hora e só pode ser usado uma vez. Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
