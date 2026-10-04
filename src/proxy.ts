import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NOME, segredo, verificarSessao } from "@/lib/sessao";
import { destinoDaRota } from "@/lib/rotas";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessao = verificarSessao(request.cookies.get(COOKIE_NOME)?.value, segredo());
  const destino = destinoDaRota(pathname, sessao);

  if (destino !== "seguir") {
    return NextResponse.redirect(new URL(destino, request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
