import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NOME, tokenEsperado } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NOME)?.value;
  if (cookie !== tokenEsperado()) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
