"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase/client";
import { COOKIE_NOME, assinarSessao } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  const { data: professor } = await supabase
    .from("professores")
    .select("id, senha_hash, email_verificado")
    .eq("email", email)
    .maybeSingle();

  const senhaConfere = professor ? await bcrypt.compare(senha, professor.senha_hash) : false;
  if (!professor || !senhaConfere) {
    redirect("/login?erro=1");
  }
  if (!professor.email_verificado) {
    redirect("/login?erro=nao-verificado");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NOME, assinarSessao(professor.id), {
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
