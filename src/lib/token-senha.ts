import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sessao, TipoConta } from "./sessao";

const VALIDADE_MS = 60 * 60 * 1000;

/** Parte do id no token: `uuid` para professor (formato legado) e `a~uuid` para aluno. */
function parteId(tipo: TipoConta, id: string): string {
  return tipo === "a" ? `a~${id}` : id;
}

function lerParteId(parte: string): Sessao | null {
  if (!parte) return null;
  if (parte.startsWith("a~")) return parte.length > 2 ? { tipo: "a", id: parte.slice(2) } : null;
  return { tipo: "p", id: parte };
}

function assinar(parte: string, expira: number, senhaHash: string, chave: string): string {
  return createHmac("sha256", chave).update(`redefinir:${parte}:${expira}:${senhaHash}`).digest("hex");
}

/**
 * Token do link "esqueci minha senha": `parteId.expira.assinatura`. Não fica salvo no banco —
 * a assinatura inclui o hash atual da senha, então o link morre sozinho assim que a senha muda.
 */
export function gerarTokenRedefinicao(
  id: string,
  senhaHash: string,
  chave: string,
  agora = Date.now(),
  tipo: TipoConta = "p"
): string {
  const expira = agora + VALIDADE_MS;
  const parte = parteId(tipo, id);
  return `${parte}.${expira}.${assinar(parte, expira, senhaHash, chave)}`;
}

/** Tipo e id da conta dona do token, sem validar nada — só pra saber qual hash buscar. */
export function contaDoToken(token: string | undefined): Sessao | null {
  const partes = token?.split(".") ?? [];
  return partes.length === 3 ? lerParteId(partes[0]) : null;
}

/** Conta do token se é autêntico, não expirou e a senha não mudou desde que foi gerado; senão null. */
export function validarTokenRedefinicao(
  token: string,
  senhaHash: string | null,
  chave: string,
  agora = Date.now()
): Sessao | null {
  const [parte, expiraTexto, assinatura] = token.split(".");
  const expira = Number(expiraTexto);
  const conta = lerParteId(parte ?? "");
  if (!conta || !assinatura || !senhaHash || !Number.isFinite(expira) || expira < agora) return null;

  const esperada = Buffer.from(assinar(parte, expira, senhaHash, chave));
  const recebida = Buffer.from(assinatura);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  return conta;
}
