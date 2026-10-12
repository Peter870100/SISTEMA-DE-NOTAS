import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { PageLayout } from "@/components/layout/PageLayout";
import { ConfiguracoesPainel } from "@/components/configuracoes/ConfiguracoesPainel";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const atual = await getProfessorAtual();
  if (!atual) redirect("/login");

  return (
    <PageLayout crumb="Configurações" titulo="Configurações" subtitulo="Tudo o que você pode ajustar na plataforma, em um só lugar." largura="max-w-6xl">
      <ConfiguracoesPainel role={atual.role} />
    </PageLayout>
  );
}
