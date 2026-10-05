export const DOMINIO_BASE = "statusavalia.com.br";
export const SLUG_PADRAO = "status";
export const SUBDOMINIOS_RESERVADOS = ["www", "api", "app", "admin", "dono", "mail", "smtp", "ftp", "status", "suporte", "ajuda", "login", "static", "cdn"] as const;

const FORMATO_SUBDOMINIO = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Slug da escola pelo endereço; null se o endereço não é de nenhuma escola. */
export function escolaDoHost(host: string | null | undefined): string | null {
  if (!host) return SLUG_PADRAO;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (h === DOMINIO_BASE || h === `www.${DOMINIO_BASE}`) return SLUG_PADRAO;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".vercel.app")) return SLUG_PADRAO;
  if (!h.endsWith(`.${DOMINIO_BASE}`)) return null;
  const sub = h.slice(0, -(DOMINIO_BASE.length + 1));
  return /^[a-z0-9-]+$/.test(sub) ? sub : null;
}

export function urlDaEscola(slug: string, caminho: string): string {
  const host = slug === SLUG_PADRAO ? `www.${DOMINIO_BASE}` : `${slug}.${DOMINIO_BASE}`;
  return `https://${host}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

export function validarSubdominio(s: string): string | null {
  if (!FORMATO_SUBDOMINIO.test(s)) return "Use de 3 a 30 letras minúsculas, números ou hífen (sem hífen no começo ou no fim).";
  if ((SUBDOMINIOS_RESERVADOS as readonly string[]).includes(s)) return "Esse endereço é reservado. Escolha outro.";
  return null;
}

/** O login só vale no endereço da escola da conta. */
export function destinoDoLogin(slugDaConta: string, slugDoEndereco: string | null): { ok: true } | { ok: false; slug: string } {
  return slugDoEndereco === slugDaConta ? { ok: true } : { ok: false, slug: slugDaConta };
}
