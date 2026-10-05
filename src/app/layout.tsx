import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JetBrains_Mono, Manrope, Rajdhani, Space_Grotesk } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { getAlunoAtual, getProfessorAtual } from "@/lib/auth";
import { CommandProvider } from "@/components/command/CommandProvider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { EscolaProvider } from "@/components/layout/EscolaContexto";
import { MARCA_PADRAO, marcaDaEscola } from "@/lib/marca";
import { ESCOLA_PADRAO_ID, obterEscola } from "@/lib/escolas";
import "./globals.css";
import { ehRotaPublica } from "@/lib/rotas";
import { ehAdmin } from "@/lib/papeis";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const rajdhani = Rajdhani({ variable: "--font-rajdhani", subsets: ["latin"], weight: ["600", "700"], display: "swap" });

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
    if (pathname && pathname !== "/trocar-senha" && !ehRotaPublica(pathname)) {
      redirect("/trocar-senha");
    }
  }

  const aluno = professor ? null : await getAlunoAtual();
  let marca = MARCA_PADRAO;
  try {
    const escola = await obterEscola(professor?.escola_id ?? aluno?.escola_id ?? ESCOLA_PADRAO_ID);
    marca = marcaDaEscola(escola);
  } catch {
    // Se a leitura de escolas falhar, o site continua com a marca padrão.
  }

  const turmasPaleta = professor && !professor.senha_provisoria ? await listarTurmasAcessiveis() : [];

  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="flex h-dvh min-h-dvh flex-row overflow-hidden bg-canvas">
        <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-brand focus:shadow-float">
          Pular para o conteúdo principal
        </a>
        <EscolaProvider marca={marca}>
        <CommandProvider>
          <Sidebar professor={professor} turmas={turmasPaleta} />
          <div id="conteudo-principal" tabIndex={-1} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-none">{children}</div>
          {professor && !professor.senha_provisoria && (
            <CommandPalette turmas={turmasPaleta} ehAdmin={ehAdmin(professor.role)} />
          )}
        </CommandProvider>
        </EscolaProvider>
      </body>
    </html>
  );
}
