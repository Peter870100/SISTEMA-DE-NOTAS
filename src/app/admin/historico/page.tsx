import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { listarHistorico } from "@/actions/historico";
import { supabase } from "@/lib/supabase/client";
import { HistoricoTable } from "@/components/admin/HistoricoTable";
import { PageLayout } from "@/components/layout/PageLayout";
import { ehAdmin } from "@/lib/papeis";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const atual = await getProfessorAtual();
  if (!atual || !ehAdmin(atual.role)) {
    redirect("/");
  }

  const [pagina, { data: turmas }, { data: professores }] = await Promise.all([
    listarHistorico(),
    supabase.from("turmas").select("id, nome").order("nome"),
    supabase.from("professores").select("id, nome").eq("role", "professor").order("nome"),
  ]);

  return (
    <PageLayout
      crumb="Administração"
      titulo="Histórico de alterações"
      subtitulo="Toda alteração de nota feita por professores (não-admin), mais recente primeiro."
      largura="max-w-4xl"
      acoes={
        <Link href="/admin/professores" className="inline-flex items-center gap-1.5 rounded-control border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20">
          <ArrowLeft size={14} />
          Voltar
        </Link>
      }
    >
      <HistoricoTable
        linhasIniciais={pagina.linhas}
        cursorInicial={pagina.proximoCursor}
        turmas={turmas ?? []}
        professores={professores ?? []}
      />
    </PageLayout>
  );
}
