"use client";

import { useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Contact, KeyRound, LogOut, Users, History, GraduationCap, Search, Trash2, FileSpreadsheet, ClipboardList, Timer, Building2, Settings } from "lucide-react";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/ui/Avatar";
import { useComandosOpcional } from "@/components/command/CommandProvider";
import { Modal } from "@/components/ui/Modal";
import { ExportarBimestre } from "@/components/home/ExportarBimestre";
import type { Professor, Turma } from "@/lib/types";
import { ehAdmin } from "@/lib/papeis";



const itemBase =
  "sidebar-botao group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition";

export function Sidebar({ professor, turmas }: { professor: Professor | null; turmas: Turma[] }) {
  const pathname = usePathname();
  const [exportacaoAberta, setExportacaoAberta] = useState(false);
  const [etiqueta, setEtiqueta] = useState<{ texto: string; esquerda: number; topo: number } | null>(null);
  const comandos = useComandosOpcional();

  const onAbrirBusca = professor && !professor.senha_provisoria ? comandos?.abrir : undefined;
  function mostrarEtiqueta(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) {
    if (!(event.target instanceof Element)) return;
    const botao = event.target.closest<HTMLElement>("[data-label]");
    if (!botao) return;
    const rect = botao.getBoundingClientRect();
    setEtiqueta({ texto: botao.dataset.label ?? "", esquerda: rect.right + 12, topo: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)) });
  }

  function ocultarEtiqueta(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) {
    if (event.target instanceof Element && event.relatedTarget instanceof Element && event.target.closest("[data-label]") === event.relatedTarget.closest("[data-label]")) return;
    setEtiqueta(null);
  }

  if (!professor) return null;

  const itens = [
    { href: "/", icon: GraduationCap, cor: "azul", label: "Turmas", ativo: pathname === "/" || pathname.startsWith("/turma/") },
    { href: "/cursos", icon: BookOpen, cor: "ciano", label: "Aulas", ativo: pathname.startsWith("/cursos") },
    { href: "/banco", icon: ClipboardList, cor: "laranja", label: "Questões", ativo: pathname.startsWith("/banco") },
    { href: "/simulados", icon: Timer, cor: "lilas", label: "Simulados", ativo: pathname.startsWith("/simulados") },
    ...(ehAdmin(professor.role) ? [
      { href: "/admin/professores", icon: Users, cor: "verde", label: "Professores", ativo: pathname === "/admin/professores" },
      { href: "/admin/alunos", icon: Contact, cor: "turquesa", label: "Alunos", ativo: pathname === "/admin/alunos" },
      { href: "/admin/historico", icon: History, cor: "lilas", label: "Histórico", ativo: pathname === "/admin/historico" },
      { href: "/admin/lixeira", icon: Trash2, cor: "coral", label: "Lixeira", ativo: pathname === "/admin/lixeira" },
    ] : []),
    ...(professor.role === "dono" ? [
      { href: "/dono", icon: Building2, cor: "dourado", label: "Escolas", ativo: pathname.startsWith("/dono") },
    ] : []),
    { href: "/trocar-senha", icon: KeyRound, cor: "dourado", label: "Senha", ativo: pathname === "/trocar-senha" },
  ];

  return (
    <aside onMouseOver={mostrarEtiqueta} onMouseOut={ocultarEtiqueta} onFocus={mostrarEtiqueta} onBlur={ocultarEtiqueta} onScrollCapture={() => setEtiqueta(null)} className="sidebar-status sticky top-0 z-30 flex h-dvh w-16 shrink-0 flex-col items-center gap-2 border-r border-frame-line bg-frame-deep px-0 py-4 md:w-20">
      <nav aria-label="Navegação principal" className="flex min-h-0 w-full flex-col items-center gap-1.5">
        {onAbrirBusca && (
          <button type="button" onClick={onAbrirBusca} aria-label="Buscar (Ctrl+K)" data-label="Buscar (Ctrl+K)" data-cor="ciano" className={`${itemBase} text-frame-muted hover:bg-white/10 hover:text-white md:mb-2`}>
            <Search size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
        {itens.map(({ href, icon: Icon, cor, label, ativo }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            data-label={label}
            data-cor={cor}
            aria-current={ativo ? (pathname === href ? "page" : "location") : undefined}
            className={`${itemBase} ${ativo ? "bg-gold text-gold-ink shadow-[0_0_18px_rgb(245_217_10_/_0.4)]" : "text-frame-muted hover:bg-white/10 hover:text-white"}`}
          >
            <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        ))}
        {!professor.senha_provisoria && turmas.length > 0 && (
          <button type="button" onClick={() => setExportacaoAberta(true)} aria-label="Exportar turmas" data-label="Exportar turmas" data-cor="verde" aria-haspopup="dialog" className={`${itemBase} text-frame-muted hover:bg-white/10 hover:text-white`}>
            <FileSpreadsheet size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </nav>
      <div className="mt-auto flex shrink-0 flex-col items-center gap-3">
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          data-label="Configurações"
          data-cor="dourado"
          aria-current={pathname === "/configuracoes" ? "page" : undefined}
          className={`${itemBase} ${pathname === "/configuracoes" ? "bg-gold text-gold-ink shadow-[0_0_18px_rgb(245_217_10_/_0.4)]" : "text-frame-muted hover:bg-white/10 hover:text-white"}`}
        >
          <Settings size={22} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <span title={professor.nome} className="block">
          <Avatar nome={professor.nome} />
        </span>
        <form action={logout}>
          <button type="submit" aria-label="Sair" data-label="Sair" data-cor="coral" className={`${itemBase} text-frame-muted hover:bg-danger/20 hover:text-white`}>
            <LogOut size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </form>
      </div>
      {etiqueta && createPortal(
        <div aria-hidden="true" className="sidebar-etiqueta" style={{ left: etiqueta.esquerda, top: etiqueta.topo, maxWidth: `calc(100vw - ${etiqueta.esquerda + 8}px)` }}>{etiqueta.texto}</div>,
        document.body
      )}
      <Modal open={exportacaoAberta} onClose={() => setExportacaoAberta(false)} titulo="Exportar turmas" descricao="Escolha um bimestre ou exporte todos em um arquivo Excel.">
        <ExportarBimestre turmas={turmas} />
      </Modal>
    </aside>
  );
}
