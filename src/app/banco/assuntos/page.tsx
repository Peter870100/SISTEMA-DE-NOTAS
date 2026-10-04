import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAssuntos } from "@/components/questoes/GerenciarAssuntos";

export const dynamic = "force-dynamic";

export default async function AssuntosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (professor.role !== "dono") redirect("/banco");
  const { data: assuntos } = await supabase.from("assuntos").select("*").order("materia").order("nome");
  return <PageLayout crumb="Banco de questões" titulo="Assuntos" largura="max-w-4xl"><GerenciarAssuntos assuntos={assuntos ?? []} /></PageLayout>;
}
