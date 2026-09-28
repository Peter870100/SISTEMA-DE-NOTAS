"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut, Users, History, GraduationCap, Search } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import type { Professor } from "@/lib/types";

type SidebarProps = {
  professor: Professor | null;
  onAbrirBusca?: () => void;
};

const itemBase =
  "group relative flex h-11 w-11 items-center justify-center rounded-[11px] transition md:h-10 md:w-10";

export function Sidebar({ professor, onAbrirBusca }: SidebarProps) {
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
    <aside className="flex shrink-0 items-center gap-2 border-b border-frame-line bg-frame-deep px-3 py-2 md:sticky md:top-0 md:h-dvh md:w-16 md:flex-col md:border-r md:border-b-0 md:px-0 md:py-4">
      <Link href="/" aria-label="Colégio Status — início" className="mr-auto rounded md:hidden">
        <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="h-7 w-auto" priority />
      </Link>
      <nav aria-label="Navegação principal" className="flex items-center gap-1 md:flex-col md:gap-2">
        {onAbrirBusca && (
          <button type="button" onClick={onAbrirBusca} aria-label="Buscar (Ctrl+K)" title="Buscar (Ctrl+K)" className={`${itemBase} text-frame-muted hover:bg-white/10 hover:text-white md:mb-2`}>
            <Search size={18} aria-hidden="true" />
          </button>
        )}
        {itens.map(({ href, icon: Icon, label, ativo }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={ativo ? (pathname === href ? "page" : "location") : undefined}
            className={`${itemBase} ${ativo ? "bg-gold text-gold-ink shadow-[0_0_18px_rgb(245_217_10_/_0.4)]" : "text-frame-muted hover:bg-white/10 hover:text-white"}`}
          >
            <Icon size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1 md:mt-auto md:flex-col md:gap-3">
        <span title={professor.nome} className="hidden md:block">
          <Avatar nome={professor.nome} />
        </span>
        <form action={logout}>
          <button type="submit" aria-label="Sair" title="Sair" className={`${itemBase} text-frame-muted hover:bg-danger/20 hover:text-white`}>
            <LogOut size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
}
