"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Home, Settings, Users } from "lucide-react";

const ITENS = [
  { href: "/", icon: Home, label: "Início" },
  { href: "/", icon: Users, label: "Turmas" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/40">
        <GraduationCap size={18} />
      </div>
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
      <button
        type="button"
        disabled
        title="Configurações (em breve)"
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 dark:text-neutral-700"
      >
        <Settings size={18} />
      </button>
    </aside>
  );
}
