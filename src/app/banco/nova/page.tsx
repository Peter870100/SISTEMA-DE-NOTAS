import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function NovaQuestaoPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: assuntos } = await supabase.from("assuntos").select("*").order("nome");
  return (
    <PageLayout crumb="Banco de questões" titulo="Nova questão" subtitulo="Depois de criar, você pode adicionar imagens." largura="max-w-3xl">
      <section className={`${estilos.card} p-4`}><EditorQuestao questao={null} imagens={[]} assuntos={assuntos ?? []} podeEscolherGeral={professor.role === "dono"} /></section>
    </PageLayout>
  );
}
