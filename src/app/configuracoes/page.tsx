import { ehAdmin } from "@/lib/papeis";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { mediaAprovacaoDaEscola } from "@/lib/relatorios/media";
import { REGRAS_PADRAO } from "@/lib/plano/regras";
import { regrasDaEscola } from "@/lib/plano/regras-servidor";
import { lerNomesProfessor } from "@/lib/professores/nome-prova";
import { PageLayout } from "@/components/layout/PageLayout";
import { ConfiguracoesPainel } from "@/components/configuracoes/ConfiguracoesPainel";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const atual = await getProfessorAtual();
  if (!atual) redirect("/login");

  const [media, nomes, regras] = await Promise.all([
    ehAdmin(atual.role) ? mediaAprovacaoDaEscola(atual.escola_id) : Promise.resolve(6),
    lerNomesProfessor(atual.id),
    ehAdmin(atual.role) ? regrasDaEscola(atual.escola_id) : Promise.resolve(REGRAS_PADRAO),
  ]);

  return (
    <PageLayout crumb="Configurações" titulo="Configurações" subtitulo="Tudo o que você pode ajustar na plataforma, em um só lugar." largura="max-w-6xl">
      <ConfiguracoesPainel role={atual.role} mediaAprovacao={media} nomeProva={nomes?.nome_prova ?? ""} regras={regras} />
    </PageLayout>
  );
}
