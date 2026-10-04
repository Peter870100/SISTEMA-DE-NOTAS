"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut, Users, History, GraduationCap, Search, Trash2, FileSpreadsheet } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import { useComandosOpcional } from "@/components/command/CommandProvider";
import { Modal } from "@/components/ui/Modal";
import { ExportarBimestre } from "@/components/home/ExportarBimestre";
import type { Professor, Turma } from "@/lib/types";


const itemBase =
  "group relative flex h-11 w-11 items-center justify-center rounded-[11px] transition md:h-10 md:w-10";

export function Sidebar({ professor, turmas }: { professor: Professor | null; turmas: Turma[] }) {
  const pathname = usePathname();
  const [exportacaoAberta, setExportacaoAberta] = useState(false);
  const comandos = useComandosOpcional();
  const onAbrirBusca = professor && !professor.senha_provisoria ? comandos?.abrir : undefined;
  if (!professor) return null;

  const itens = [
    { href: "/", icon: GraduationCap, label: "Turmas", ativo: pathname === "/" || pathname.startsWith("/turma/") },
    ...(professor.role === "admin" ? [
      { href: "/admin/professores", icon: Users, label: "Professores", ativo: pathname === "/admin/professores" },
      { href: "/admin/historico", icon: History, label: "Histórico", ativo: pathname === "/admin/historico" },
      { href: "/admin/lixeira", icon: Trash2, label: "Lixeira", ativo: pathname === "/admin/lixeira" },
    ] : []),
    { href: "/trocar-senha", icon: KeyRound, label: "Senha", ativo: pathname === "/trocar-senha" },
  ];

  return (
    <aside className="flex shrink-0 flex-wrap items-center gap-2 border-b border-frame-line bg-frame-deep px-3 py-2 md:sticky md:top-0 md:h-dvh md:w-16 md:flex-col md:flex-nowrap md:border-r md:border-b-0 md:px-0 md:py-4">
      <Link href="/" aria-label="Colégio Status — início" className="mr-auto rounded md:hidden">
        <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="h-7 w-auto" preload />
      </Link>
      <nav aria-label="Navegação principal" className="order-last flex w-full flex-wrap items-center justify-center gap-1 md:order-none md:w-auto md:flex-col md:gap-2">
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
        {!professor.senha_provisoria && turmas.length > 0 && (
          <button type="button" onClick={() => setExportacaoAberta(true)} aria-label="Exportar turmas" title="Exportar turmas" aria-haspopup="dialog" className={`${itemBase} text-frame-muted hover:bg-white/10 hover:text-white`}>
            <FileSpreadsheet size={18} aria-hidden="true" />
          </button>
        )}
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
      <Modal open={exportacaoAberta} onClose={() => setExportacaoAberta(false)} titulo="Exportar turmas" descricao="Escolha um bimestre ou exporte todos em um arquivo Excel.">
        <ExportarBimestre turmas={turmas} />
      </Modal>
    </aside>
  );
}
