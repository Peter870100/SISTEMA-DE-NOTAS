import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Geist_Mono, Manrope } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { getProfessorAtual } from "@/lib/auth";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full">
        <Sidebar professor={professor} />
        <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
