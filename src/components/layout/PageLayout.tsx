import Link from "next/link";
import { LogoEscola } from "@/components/layout/EscolaContexto";
import { IconePagina } from "@/components/layout/IconePagina";

type PageLayoutProps = {
  crumb?: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  largura?: "max-w-3xl" | "max-w-4xl" | "max-w-6xl" | "max-w-7xl";
  children: React.ReactNode;
};

/** Faixa azul da moldura com título + logo; o conteúdo sobe e flutua sobre a borda dela. */
export function PageLayout({ crumb, titulo, subtitulo, acoes, largura: pedida = "max-w-7xl", children }: PageLayoutProps) {
  // Telas de lista/painel usam a largura toda; formulários (3xl/4xl) continuam estreitos para leitura.
  const largura = pedida === "max-w-6xl" || pedida === "max-w-7xl" ? "max-w-none" : pedida;
  return (
    <div className="fundo-escolar flex min-h-full min-w-0 flex-1 shrink-0 flex-col">
      <header className="cabecalho-status bg-frame pb-20 text-white">
        <div className={`mx-auto w-full ${largura} px-4 pt-6 sm:px-6 lg:px-8`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {crumb && (
                <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-frame-muted">{crumb}</p>
              )}
              <h1 className="mt-2 flex items-center gap-3 break-words font-heading text-4xl font-bold uppercase leading-none tracking-[0.025em] sm:text-5xl"><IconePagina /><span className="min-w-0">{titulo}</span></h1>
              {subtitulo && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-frame-muted">{subtitulo}</p>}
            </div>
            <Link href="/" aria-label="Início" className="hidden shrink-0 rounded sm:block">
              <LogoEscola className="h-auto w-40 lg:w-52" />
            </Link>
          </div>
          {acoes && <div className="mt-4 flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      </header>
      <main className={`relative mx-auto -mt-16 flex w-full min-w-0 ${largura} flex-1 flex-col gap-5 px-4 pb-10 sm:px-6 lg:px-8`}>
        {children}
      </main>
    </div>
  );
}
