import { ehAdmin } from "@/lib/papeis";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { mediaAprovacaoDaEscola } from "@/lib/relatorios/media";
import { PageLayout } from "@/components/layout/PageLayout";
import { ConfiguracoesPainel } from "@/components/configuracoes/ConfiguracoesPainel";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const atual = await getProfessorAtual();
  if (!atual) redirect("/login");

  const media = ehAdmin(atual.role) ? await mediaAprovacaoDaEscola(atual.escola_id) : 6;

  return (
    <PageLayout crumb="Configurações" titulo="Configurações" subtitulo="Tudo o que você pode ajustar na plataforma, em um só lugar." largura="max-w-6xl">
      <ConfiguracoesPainel role={atual.role} mediaAprovacao={media} />
    </PageLayout>
  );
}
