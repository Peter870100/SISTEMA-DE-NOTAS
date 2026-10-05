import { notFound } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { FormEscola } from "@/components/dono/FormEscola";
import { PageLayout } from "@/components/layout/PageLayout";

export const dynamic = "force-dynamic";

export default async function NovaEscolaPage() {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") notFound();
  return (
    <PageLayout crumb="Plataforma" titulo="Nova escola" largura="max-w-3xl">
      <FormEscola modo="criar" />
    </PageLayout>
  );
}
