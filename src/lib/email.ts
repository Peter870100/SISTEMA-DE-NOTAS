import { Resend } from "resend";

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Defina RESEND_API_KEY.");
  return new Resend(key);
}

export async function enviarEmailVerificacao(
  destinatario: string,
  nome: string,
  link: string
): Promise<void> {
  const { error } = await client().emails.send({
    from: "Planilha Viva <onboarding@resend.dev>",
    to: destinatario,
    subject: "Confirme seu email — Planilha Viva",
    html: `
      <p>Olá, ${nome}!</p>
      <p>Confirme seu email pra ativar sua conta na Planilha Viva:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Esse link expira em 24 horas. Se você não pediu esse cadastro, pode ignorar este email.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
