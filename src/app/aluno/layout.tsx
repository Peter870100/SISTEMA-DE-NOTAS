import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpen, GraduationCap, KeyRound, LogOut, Timer } from "lucide-react";
import { logout } from "@/actions/auth";
import { getAlunoAtual } from "@/lib/auth";
import { LogoEscola } from "@/components/layout/EscolaContexto";

import { AvatarAluno } from "@/components/aluno/AvatarAluno";
import css from "./AlunoLayout.module.css";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/aluno/entrar-com-codigo")) return <>{children}</>;

  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login?erro=bloqueado");
  if (aluno.senha_provisoria && pathname !== "/aluno/trocar-senha") redirect("/aluno/trocar-senha");

  return (
    <div className="fundo-escolar flex min-h-dvh flex-1 flex-col">
      <header className="cabecalho-status border-b border-frame-line bg-frame text-white">
        <div className={css.cabecalho}>
          <Link href="/aluno" aria-label="Início" className={css.marca}>
            <LogoEscola className="h-auto w-32 lg:w-36" />
          </Link>
          <nav aria-label="Área do aluno" className={css.navegacao}>
            {[
              { href: "/aluno", icone: GraduationCap, cor: "azul", rotulo: "Início" },
              { href: "/aluno/cursos", icone: BookOpen, cor: "ciano", rotulo: "Cursos" },
              { href: "/aluno/simulados", icone: Timer, cor: "lilas", rotulo: "Simulados" },
            ].map(({ href, icone: Icone, cor, rotulo }) => {
              const ativo = href === "/aluno" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-label={rotulo} data-cor={cor} aria-current={ativo ? "page" : undefined}
                  className={`sidebar-botao ${css.botao}`}>
                  <Icone size={20} strokeWidth={2.2} aria-hidden="true" /> <span className={css.rotulo}> {rotulo}</span>
                </Link>
              );
            })}
          </nav>
          <nav aria-label="Conta" className={css.conta}>
            <Link href="/aluno/trocar-senha" aria-label="Senha" data-cor="dourado" aria-current={pathname === "/aluno/trocar-senha" ? "page" : undefined} className={`sidebar-botao ${css.botao}`}>
              <KeyRound size={20} strokeWidth={2.2} aria-hidden="true" /> <span className={css.rotulo}>Senha</span>
            </Link>
            <form action={logout}>
              <button type="submit" aria-label="Sair" data-cor="coral" className={`sidebar-botao ${css.botao}`}>
                <LogOut size={20} strokeWidth={2.2} aria-hidden="true" /> <span className={css.rotulo}>Sair</span>
              </button>
            </form>
            <AvatarAluno alunoId={aluno.id} nome={aluno.nome} />
          </nav>
        </div>
      </header>
      <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 ${css.conteudo}`}>{children}</main>
    </div>
  );
}
