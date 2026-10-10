import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpen, ClipboardCheck, Home, KeyRound, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { getAlunoAtual } from "@/lib/auth";
import { LogoEscola } from "@/components/layout/EscolaContexto";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/aluno/entrar-com-codigo")) return <>{children}</>;

  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login?erro=bloqueado");
  if (aluno.senha_provisoria && pathname !== "/aluno/trocar-senha") redirect("/aluno/trocar-senha");

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="bg-frame-deep text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/aluno" aria-label="Início" className="rounded">
            <LogoEscola className="h-8 w-auto" />
          </Link>
          <nav aria-label="Área do aluno" className="flex items-center gap-1 text-sm">
            {[
              { href: "/aluno", icone: Home, rotulo: "Início" },
              { href: "/aluno/cursos", icone: BookOpen, rotulo: "Cursos" },
              { href: "/aluno/simulados", icone: ClipboardCheck, rotulo: "Simulados" },
            ].map(({ href, icone: Icone, rotulo }) => {
              const ativo = href === "/aluno" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-label={rotulo} aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-control px-3 hover:bg-white/10 ${ativo ? "bg-white/15" : ""}`}>
                  <Icone size={16} aria-hidden="true" /> <span className="hidden sm:inline">{rotulo}</span>
                </Link>
              );
            })}
          </nav>
          <nav aria-label="Conta" className="ml-auto flex items-center gap-1 text-sm">
            <span className="mr-2 hidden text-frame-muted sm:inline">{aluno.nome}</span>
            <Link href="/aluno/trocar-senha" aria-label="Senha" className="flex min-h-10 items-center gap-1.5 rounded-control px-3 hover:bg-white/10">
              <KeyRound size={16} aria-hidden="true" /> <span className="hidden sm:inline">Senha</span>
            </Link>
            <form action={logout}>
              <button type="submit" aria-label="Sair" className="flex min-h-10 items-center gap-1.5 rounded-control px-3 hover:bg-danger/20">
                <LogOut size={16} aria-hidden="true" /> <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
