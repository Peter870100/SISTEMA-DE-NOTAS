"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Building2, ClipboardList, GraduationCap, History, Library, Settings, ShieldCheck, Timer, Trash2, Users, type LucideIcon } from "lucide-react";

// Ícone do título conforme a seção (o mais específico primeiro).
const SECOES: [string, LucideIcon][] = [
  ["/admin/alunos", Users],
  ["/admin/professores", ShieldCheck],
  ["/admin/historico", History],
  ["/admin/lixeira", Trash2],
  ["/admin", ShieldCheck],
  ["/simulados", Timer],
  ["/cursos", BookOpen],
  ["/banco", Library],
  ["/turma", ClipboardList],
  ["/configuracoes", Settings],
  ["/dono", Building2],
];

/** Quadrado dourado com o ícone da seção, ao lado do título da faixa azul. */
export function IconePagina() {
  const caminho = usePathname() ?? "/";
  const Icone = SECOES.find(([prefixo]) => caminho === prefixo || caminho.startsWith(`${prefixo}/`))?.[1] ?? GraduationCap;
  return (
    <span className="icone-pagina" data-icone aria-hidden="true">
      <Icone size={26} strokeWidth={2.2} />
    </span>
  );
}
