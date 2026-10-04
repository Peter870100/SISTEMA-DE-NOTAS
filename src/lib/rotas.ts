import type { Sessao } from "./sessao";

const PREFIXOS_PUBLICOS = [
  "/login",
  "/cadastro",
  "/verificar-email",
  "/esqueci-senha",
  "/redefinir-senha",
  "/api/mcp",
  "/aluno/entrar-com-codigo",
];

export function ehRotaPublica(pathname: string): boolean {
  return PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p)) || /\.(?:png|jpe?g|webp|svg|ico|gif|mp4)$/i.test(pathname);
}

function ehAreaAluno(pathname: string): boolean {
  return pathname === "/aluno" || pathname.startsWith("/aluno/");
}

/** Para onde a requisição vai: segue, ou redireciona conforme o tipo da sessão. */
export function destinoDaRota(pathname: string, sessao: Sessao | null): "seguir" | "/login" | "/aluno" | "/" {
  if (ehRotaPublica(pathname)) return "seguir";
  if (!sessao) return "/login";
  if (sessao.tipo === "a") return ehAreaAluno(pathname) ? "seguir" : "/aluno";
  return ehAreaAluno(pathname) ? "/" : "seguir";
}
