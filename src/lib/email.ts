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
    from: "Avalia <onboarding@resend.dev>",
    to: destinatario,
    subject: "Confirme seu email — Avalia",
    html: `
      <p>Olá, ${nome}!</p>
      <p>Confirme seu email pra ativar sua conta no Avalia:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Esse link expira em 24 horas. Se você não pediu esse cadastro, pode ignorar este email.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
