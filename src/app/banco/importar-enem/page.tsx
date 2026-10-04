import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { PageLayout } from "@/components/layout/PageLayout";
import { ImportarEnem } from "@/components/questoes/ImportarEnem";

export const dynamic = "force-dynamic";

export default async function ImportarEnemPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (professor.role !== "dono") redirect("/banco");
  return (
    <PageLayout crumb="Banco de questões" titulo="Importar ENEM (enem.dev)" subtitulo="ENEM 2009–2023: questões, gabarito e imagens; a IA classifica matéria e assunto." largura="max-w-4xl">
      <ImportarEnem />
    </PageLayout>
  );
}
