import Image from "next/image";
import Link from "next/link";
import { LoginVideo } from "./LoginVideo";

type LoginShellProps = {
  children: React.ReactNode;
  action: (formData: FormData) => void | Promise<void>;
};

export function LoginShell({ children, action }: LoginShellProps) {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col bg-frame-deep text-white">
      <header className="border-b border-white/15">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 sm:px-10">
          <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} preload className="h-auto w-40 sm:w-56" />
          <nav aria-label="Acesso ao sistema" className="flex items-center gap-5 text-sm font-semibold">
            <Link href="/cadastro" className="hidden text-white/85 transition hover:text-gold sm:inline">Cadastre-se</Link>
            <a href="#acesso" className="rounded-control bg-gold px-5 py-3 text-gold-ink transition hover:brightness-105">Login</a>
          </nav>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <section aria-labelledby="apresentacao-login" className="max-w-xl">
          <div>
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-white/85"><span aria-hidden="true" className="h-0.5 w-10 shrink-0 bg-gold" />Status Avalia · Portal do professor</p>
            <h1 id="apresentacao-login" className="text-balance font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">Cada aprendizado<br />merece <span className="text-gold">atenção.</span></h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">Mais tempo para ensinar. Suas turmas, notas e o acompanhamento de cada aluno em um só lugar.</p>
          </div>
          <LoginVideo />
        </section>
        <section id="acesso" aria-labelledby="titulo-acesso" className="w-full max-w-md scroll-mt-6 justify-self-center rounded-float border border-white/25 bg-frame p-6 shadow-float sm:p-9 lg:justify-self-end">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gold">Acesso ao professor</p>
          <h2 id="titulo-acesso" className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75">Entre para acompanhar suas turmas e lançar notas.</p>
          <form action={action} className="mt-7 flex flex-col gap-5">{children}</form>
        </section>
      </div>
      <footer className="border-t-4 border-gold">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-white/75 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="font-semibold text-white">Colégio Status · Status Avalia</span>
          <span>Portal de acompanhamento da aprendizagem</span>
        </div>
      </footer>
    </main>
  );
}
