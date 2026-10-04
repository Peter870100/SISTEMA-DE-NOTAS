import Image from "next/image";
import { LoginVideo } from "./LoginVideo";

export const authInput =
  "w-full rounded-control border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-frame-muted focus:border-gold focus:ring-3 focus:ring-gold/20";

export const authBotao =
  "w-full rounded-control bg-gold px-3 py-2.5 text-sm font-extrabold text-gold-ink shadow-[0_8px_24px_rgb(245_217_10_/_0.33)] transition hover:brightness-105 disabled:opacity-60";

export function AuthAviso({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-control px-3 py-2 text-sm ${tipo === "erro" ? "bg-danger/25 text-white" : "bg-ok/25 text-white"}`}
    >
      {children}
    </p>
  );
}

type AuthShellProps = {
  videoCadastro?: boolean;
  titulo: string;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  comoForm?: (formData: FormData) => void | Promise<void>;
};

/** Fundo aurora + card de vidro com a logo oficial branca. Primeira impressão do sistema. */
export function AuthShell({ titulo, subtitulo, children, comoForm, videoCadastro = false }: AuthShellProps) {
  const conteudo = (
    <>
      <Image src="/logo-status-branca.png" alt="Colégio Status" width={1580} height={513} className="mb-6 h-auto w-full" priority />
      <h1 className="font-display text-2xl font-semibold tracking-tight">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-sm text-frame-muted">{subtitulo}</p>}
      <div className="mt-5 flex flex-col gap-3">{children}</div>
    </>
  );
  const classeCard =
    `relative z-10 w-full max-w-sm rounded-[20px] border border-white/20 ${videoCadastro ? "bg-frame-deep/80" : "bg-white/10"} p-7 text-white shadow-[0_30px_80px_rgb(0_0_0_/_0.5),inset_0_1px_0_rgb(255_255_255_/_0.15)] backdrop-blur-xl`;

  return (
    <main className="bg-aurora relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      {videoCadastro ? <LoginVideo cadastro /> : <div aria-hidden="true" className="bg-grade-tech pointer-events-none absolute inset-0" />}
      {comoForm ? (
        <form action={comoForm} className={classeCard}>{conteudo}</form>
      ) : (
        <div className={classeCard}>{conteudo}</div>
      )}
    </main>
  );
}
