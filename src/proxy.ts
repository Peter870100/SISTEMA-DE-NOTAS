import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NOME, verificarSessao } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastro") ||
    pathname.startsWith("/verificar-email") ||
    pathname.startsWith("/api/mcp") ||
    /\.(?:png|jpe?g|webp|svg|ico|gif)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NOME)?.value;
  if (!verificarSessao(cookie)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
