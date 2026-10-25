import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeVerQuestao } from "@/lib/questoes/acesso";
import { iaDisponivel } from "@/lib/questoes/ia";
import { assuntoDaBase, restanteHoje, rotuloQuestao } from "@/lib/questoes/geracao";
import { pedidasHoje } from "@/lib/questoes/geracao-servidor";
import { PageLayout } from "@/components/layout/PageLayout";
import { GeradorQuestoes } from "@/components/questoes/GeradorQuestoes";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";
// A geração pode levar até ~4,5 min; vale também para a Server Action chamada desta página.
export const maxDuration = 300;

export default async function GerarQuestoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const bruto = (await searchParams).base;
  const baseId = Array.isArray(bruto) ? bruto[0] : bruto;

  const [{ data: assuntos }, restante, baseRes] = await Promise.all([
    supabase.from("assuntos").select("id, materia, nome").eq("situacao", "aprovado").order("nome"),
    professor.role === "dono" ? Promise.resolve(null) : pedidasHoje(professor.escola_id).then((n) => restanteHoje(n, professor.role)),
    baseId ? supabase.from("questoes").select("id, banca, ano, numero, materia, assunto_id, enunciado, escopo, escola_id, status, criado_por").eq("id", baseId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const b = baseRes.data;
  const base = b && podeVerQuestao(professor, b)
    ? { id: b.id, rotulo: rotuloQuestao(b) || "Questão modelo", resumo: b.enunciado.replace(/[*]/g, "").slice(0, 140), materia: b.materia, assunto_id: assuntoDaBase(b.assunto_id, new Set((assuntos ?? []).map((a) => a.id))) }
    : null;

  return (
    <PageLayout crumb="Banco de questões" titulo="Gerar questões com IA" subtitulo="A IA escreve questões novas; confira antes de publicar." largura="max-w-6xl"
      acoes={<Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>}>
      <GeradorQuestoes assuntos={assuntos ?? []} iaOk={iaDisponivel()} restante={restante} ehDono={professor.role === "dono"} base={base} />
    </PageLayout>
  );
}
