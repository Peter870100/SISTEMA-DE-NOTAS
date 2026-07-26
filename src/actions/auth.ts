"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NOME, tokenEsperado } from "@/lib/auth";

export async function login(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");

  if (!process.env.APP_PASSWORD || senha !== process.env.APP_PASSWORD) {
    redirect("/login?erro=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NOME, tokenEsperado(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NOME);
  redirect("/login");
}
