import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { atualizarImportacao } from "@/actions/importacoes";
import { PageLayout } from "@/components/layout/PageLayout";
import { AcompanharImportacao } from "@/components/questoes/AcompanharImportacao";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProfessorAtual())) redirect("/login");
  let inicial;
  try { inicial = await atualizarImportacao(id); } catch { notFound(); }
  return (
    <PageLayout crumb="Banco de questões" titulo="Importação" largura="max-w-4xl">
      <AcompanharImportacao importacaoId={id} inicial={inicial} />
    </PageLayout>
  );
}
