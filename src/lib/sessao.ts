import { createHmac, timingSafeEqual } from "node:crypto";

export type TipoConta = "p" | "a";
export type Sessao = { tipo: TipoConta; id: string };

export function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Defina AUTH_SECRET.");
  return s;
}

function hmac(texto: string, chave: string): string {
  return createHmac("sha256", chave).update(texto).digest("hex");
}

/** Valor do cookie de sessão: `tipo:id.assinatura`, com a assinatura cobrindo `tipo:id`. */
export function assinarSessao(tipo: TipoConta, id: string, chave: string): string {
  return `${tipo}:${id}.${hmac(`${tipo}:${id}`, chave)}`;
}

/** Sessão do cookie, ou null se inválido/adulterado. Cookie antigo sem `tipo:` é de professor. */
export function verificarSessao(cookie: string | undefined, chave: string): Sessao | null {
  if (!cookie) return null;
  const ponto = cookie.lastIndexOf(".");
  if (ponto <= 0) return null;
  const assinado = cookie.slice(0, ponto);
  const assinatura = cookie.slice(ponto + 1);

  const recebida = Buffer.from(assinatura);
  const esperada = Buffer.from(hmac(assinado, chave));
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  const doisPontos = assinado.indexOf(":");
  if (doisPontos === -1) return { tipo: "p", id: assinado };
  const tipo = assinado.slice(0, doisPontos);
  const id = assinado.slice(doisPontos + 1);
  if ((tipo !== "p" && tipo !== "a") || !id) return null;
  return { tipo, id };
}
