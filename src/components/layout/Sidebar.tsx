"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, KeyRound, LogOut, Settings, Users } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import type { Professor } from "@/lib/types";

const ITENS = [
  { href: "/", icon: Home, label: "Início" },
  { href: "/", icon: Users, label: "Turmas" },
] as const;

type SidebarProps = {
  professor: Professor | null;
};

export function Sidebar({ professor }: SidebarProps) {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Link
        href="/"
        title="Colégio Status"
        className="relative mb-4 h-9 w-9 shrink-0 overflow-hidden rounded-lg"
      >
        <Image
          src="/LOGO2025_CURVAS.png"
          alt="Colégio Status"
          fill
          className="object-cover object-left"
          priority
        />
      </Link>
      {ITENS.map(({ href, icon: Icon, label }) => {
        const ativo = pathname === href;
        return (
          <Link
            key={label}
            href={href}
            title={label}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              ativo
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon size={18} />
          </Link>
        );
      })}
      {professor?.role === "admin" ? (
        <Link
          href="/admin/professores"
          title="Gerenciar professores"
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            pathname === "/admin/professores"
              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          }`}
        >
          <Settings size={18} />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title="Configurações (só para admin)"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 dark:text-neutral-700"
        >
          <Settings size={18} />
        </button>
      )}
      {professor && (
        <Link
          href="/trocar-senha"
          title="Trocar senha"
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            pathname === "/trocar-senha"
              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          }`}
        >
          <KeyRound size={18} />
        </Link>
      )}
      {professor && (
        <div className="mt-auto mb-1" title={`Logado como ${professor.nome}`}>
          <Avatar nome={professor.nome} />
        </div>
      )}
      <form action={logout} className={professor ? "" : "mt-auto"}>
        <button
          type="submit"
          title="Sair"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
        >
          <LogOut size={18} />
        </button>
      </form>
    </aside>
  );
}
