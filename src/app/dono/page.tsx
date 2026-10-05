import Link from "next/link";
import { notFound } from "next/navigation";
import { listarEscolas } from "@/actions/dono";
import { getProfessorAtual } from "@/lib/auth";
import { DOMINIO_BASE, SLUG_PADRAO } from "@/lib/dominio";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function DonoPage() {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") notFound();
  const escolas = await listarEscolas();

  return (
    <PageLayout
      crumb="Plataforma"
      titulo="Escolas"
      subtitulo="Só o dono da plataforma vê esta página. Apenas contagens, nunca dados das escolas."
      largura="max-w-6xl"
      acoes={<Link href="/dono/escolas/nova" className={estilos.botaoPrimario}>Nova escola</Link>}
    >
      <div className={`${estilos.card} overflow-x-auto`}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-4 py-3 font-semibold">Escola</th>
              <th className="px-4 py-3 font-semibold">Endereço</th>
              <th className="px-4 py-3 font-semibold">Situação</th>
              <th className="px-4 py-3 text-right font-semibold">Professores</th>
              <th className="px-4 py-3 text-right font-semibold">Turmas</th>
              <th className="px-4 py-3 text-right font-semibold">Contas</th>
            </tr>
          </thead>
          <tbody>
            {escolas.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/dono/escolas/${e.id}`} className="font-semibold text-brand hover:underline">{e.nome}</Link>
                </td>
                <td className="px-4 py-3 text-muted">{e.slug === SLUG_PADRAO ? `www.${DOMINIO_BASE}` : `${e.slug}.${DOMINIO_BASE}`}</td>
                <td className="px-4 py-3">{e.ativa ? "Ativa" : "Desativada"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.professores}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.turmas}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.contas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
