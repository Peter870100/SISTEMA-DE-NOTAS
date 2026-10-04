import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listarLixeira } from "@/actions/lixeira";
import { PageLayout } from "@/components/layout/PageLayout";
import { LixeiraLista } from "@/components/admin/LixeiraLista";
import { ehAdmin } from "@/lib/papeis";

export const dynamic = "force-dynamic";

export default async function LixeiraPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) redirect("/");

  const itens = await listarLixeira();

  return (
    <PageLayout
      crumb="Administração"
      titulo="Lixeira"
      subtitulo="Tudo que foi excluído — pela tela ou pelo Hermes — fica aqui até você restaurar ou apagar de vez."
      largura="max-w-4xl"
    >
      <LixeiraLista itensIniciais={itens} />
    </PageLayout>
  );
}
