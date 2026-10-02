import { createHmac, timingSafeEqual } from "node:crypto";

const VALIDADE_MS = 60 * 60 * 1000;

function assinar(professorId: string, expira: number, senhaHash: string, segredo: string): string {
  return createHmac("sha256", segredo).update(`redefinir:${professorId}:${expira}:${senhaHash}`).digest("hex");
}

/**
 * Token do link "esqueci minha senha": `id.expira.assinatura`. Não fica salvo no banco —
 * a assinatura inclui o hash atual da senha, então o link morre sozinho assim que a senha muda.
 */
export function gerarTokenRedefinicao(
  professorId: string,
  senhaHash: string,
  segredo: string,
  agora = Date.now()
): string {
  const expira = agora + VALIDADE_MS;
  return `${professorId}.${expira}.${assinar(professorId, expira, senhaHash, segredo)}`;
}

/** Id do professor dono do token, sem validar nada — só pra saber qual hash buscar no banco. */
export function idDoTokenRedefinicao(token: string | undefined): string | null {
  const partes = token?.split(".") ?? [];
  return partes.length === 3 && partes[0] ? partes[0] : null;
}

/** Id do professor se o token é autêntico, não expirou e a senha não mudou desde que foi gerado; senão null. */
export function validarTokenRedefinicao(
  token: string,
  senhaHash: string | null,
  segredo: string,
  agora = Date.now()
): string | null {
  const [professorId, expiraTexto, assinatura] = token.split(".");
  const expira = Number(expiraTexto);
  if (!professorId || !assinatura || !senhaHash || !Number.isFinite(expira) || expira < agora) return null;

  const esperada = Buffer.from(assinar(professorId, expira, senhaHash, segredo));
  const recebida = Buffer.from(assinatura);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  return professorId;
}
