import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { getProfessorAtual } from "@/lib/auth";
import { CommandProvider } from "@/components/command/CommandProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Avalia — Notas de Redação",
  description: "Gestão de notas de redação por turma",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const professor = await getProfessorAtual();

  if (professor?.senha_provisoria) {
    const pathname = (await headers()).get("x-pathname");
    if (pathname && pathname !== "/trocar-senha") {
      redirect("/trocar-senha");
    }
  }

  const turmasPaleta = professor && !professor.senha_provisoria ? await listarTurmasAcessiveis() : [];

  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas md:flex-row">
        <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-brand focus:shadow-float">
          Pular para o conteúdo principal
        </a>
        <CommandProvider>
          <Sidebar professor={professor} />
          <div id="conteudo-principal" tabIndex={-1} className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
          {professor && !professor.senha_provisoria && (
            <CommandPalette turmas={turmasPaleta} ehAdmin={professor.role === "admin"} />
          )}
        </CommandProvider>
      </body>
    </html>
  );
}
