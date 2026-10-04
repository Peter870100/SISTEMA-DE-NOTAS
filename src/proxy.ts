import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NOME } from "@/lib/auth";
import { segredo, verificarSessao } from "@/lib/sessao";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/verificar-email") ||
    pathname.startsWith("/esqueci-senha") ||
    pathname.startsWith("/redefinir-senha") ||
    pathname.startsWith("/api/mcp") ||
    /\.(?:png|jpe?g|webp|svg|ico|gif)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NOME)?.value;
  if (!verificarSessao(cookie, segredo())) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
