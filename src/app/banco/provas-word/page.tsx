import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Globe, ListChecks, Send } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { LIMITE_QUESTOES_PROVA } from "@/lib/folha/provas-word";
import { listarProvas } from "@/lib/folha/provas-word-servidor";
import { PageLayout } from "@/components/layout/PageLayout";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { estilos } from "@/components/ui/estilos";
import { Historico, type ItemHistorico } from "./Historico";
import { NovaProva } from "./NovaProva";

export const dynamic = "force-dynamic";
// Vale para as Server Actions desta página (a prévia e o gerar leem o banco inteiro do filtro).
export const maxDuration = 60;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Campo_Grande", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function ProvasWordPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  const provas = await listarProvas(professor.id);
  // O dono gera provas em várias escolas: mostra o nome da escola em cada uma.
  const nomesEscola = new Map<string, string>();
  if (professor.role === "dono" && provas.length) {
    const { data } = await supabase.from("escolas").select("id, nome").in("id", [...new Set(provas.map((p) => p.escola_id))]);
    for (const e of data ?? []) nomesEscola.set(e.id as string, e.nome as string);
  }
  const itens: ItemHistorico[] = provas.map((p) => ({
    id: p.id,
    data: dataHora(p.created_at),
    titulo: p.titulo,
    total: p.total,
    origem: p.origem,
    escola: professor.role === "dono" ? (nomesEscola.get(p.escola_id) ?? null) : null,
  }));

  const painel: ItemResumo[] = [
    { rotulo: "Provas", valor: provas.length.toLocaleString("pt-BR"), detalhe: "no seu histórico", Icone: FileText },
    { rotulo: "Questões", valor: provas.reduce((s, p) => s + p.total, 0).toLocaleString("pt-BR"), detalhe: "nas provas da lista", Icone: ListChecks },
    { rotulo: "Pelo Telegram", valor: provas.filter((p) => p.origem === "hermes").length.toLocaleString("pt-BR"), detalhe: "pedidas à Hermes", Icone: Send },
    { rotulo: "Pelo site", valor: provas.filter((p) => p.origem === "site").length.toLocaleString("pt-BR"), detalhe: "geradas nesta página", Icone: Globe },
  ];

  return (
    <PageLayout crumb="Banco de questões" titulo="Provas em Word" subtitulo="Provas para imprimir com questões oficiais do banco, com figuras, e o gabarito em arquivo separado." largura="max-w-7xl"
      acoes={<Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>}>
      <PainelResumo itens={painel} />
      <NovaProva limite={LIMITE_QUESTOES_PROVA} />
      <Historico provas={itens} />
    </PageLayout>
  );
}
