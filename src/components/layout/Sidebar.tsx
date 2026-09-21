"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut, Users, History, GraduationCap } from "lucide-react";
import { logout } from "@/actions/auth";
import type { Professor } from "@/lib/types";

export function Sidebar({ professor }: { professor: Professor | null }) {
  const pathname = usePathname();
  if (!professor) return null;

  const itens = [
    { href: "/", icon: GraduationCap, label: "Turmas", ativo: pathname === "/" || pathname.startsWith("/turma/") },
    ...(professor.role === "admin" ? [
      { href: "/admin/professores", icon: Users, label: "Professores", ativo: pathname === "/admin/professores" },
      { href: "/admin/historico", icon: History, label: "Histórico", ativo: pathname === "/admin/historico" },
    ] : []),
    { href: "/trocar-senha", icon: KeyRound, label: "Senha", ativo: pathname === "/trocar-senha" },
  ];

  return (
    <aside className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white p-3 md:w-36 md:border-r md:border-b-0 md:py-5">
      <Link href="/" aria-label="Status Avalia — turmas" className="hidden rounded md:block">
        <Image src="/LOGO2025_CURVAS.png" alt="Colégio Status" width={1580} height={513} className="h-auto w-full" priority />
      </Link>
      <nav aria-label="Navegação principal" className="flex flex-wrap gap-1 md:flex-col">
        {itens.map(({ href, icon: Icon, label, ativo }) => (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? (pathname === href ? "page" : "location") : undefined}
            className={"flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium " + (ativo ? "bg-blue-50 text-blue-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <form action={logout} className="ml-auto md:mt-4 md:ml-0">
          <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-rose-50 hover:text-rose-700">
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </form>
      </nav>
      <p className="mt-auto hidden break-words px-2 text-sm text-neutral-500 md:block">{professor.nome}</p>
    </aside>
  );
}
