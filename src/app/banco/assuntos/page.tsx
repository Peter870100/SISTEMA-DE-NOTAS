import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { carregarGerenciamento } from "@/lib/questoes/classificacao-pagina";
import { PageLayout } from "@/components/layout/PageLayout";
import { GerenciarAssuntos } from "@/components/questoes/GerenciarAssuntos";
import { GerenciarClassificacao } from "@/components/questoes/GerenciarClassificacao";
import { estilos } from "@/components/ui/estilos";
import styles from "@/components/questoes/GerenciarClassificacao.module.css";

export const dynamic = "force-dynamic";

const ABAS = [
  { id: "assuntos", rotulo: "Assuntos" },
  { id: "topicos", rotulo: "Tópicos por assunto" },
  { id: "habilidades", rotulo: "Habilidades por área" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Gerenciar a classificação (só o dono): assuntos propostos, tópicos com pré-requisitos e materiais, e habilidades. */
export default async function ClassificacaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (professor.role !== "dono") redirect("/banco");
  const pedida = um((await searchParams).aba);
  const aba: Aba = ABAS.some((a) => a.id === pedida) ? (pedida as Aba) : "assuntos";

  const [{ data: assuntos }, dados] = await Promise.all([
    supabase.from("assuntos").select("*").order("materia").order("nome"),
    carregarGerenciamento(),
  ]);
  // Pendências de cada aba (propostos esperando o dono). Sem as tabelas novas, só os assuntos contam.
  const pendentes: Record<Aba, number> = {
    assuntos: (assuntos ?? []).filter((a) => a.situacao === "proposto").length,
    topicos: dados?.topicos.filter((t) => t.situacao === "proposto").length ?? 0,
    habilidades: dados?.habilidades.filter((h) => h.situacao === "proposto").length ?? 0,
  };

  return (
    <PageLayout crumb="Banco de questões" titulo="Classificação" largura="max-w-7xl"
      acoes={<Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>}>
      <nav aria-label="Partes da classificação" className={styles.abas}>
        {ABAS.map((a) => (
          <Link key={a.id} href={a.id === "assuntos" ? "/banco/assuntos" : `/banco/assuntos?aba=${a.id}`} aria-current={a.id === aba ? "page" : undefined} className={styles.aba}>
            {a.rotulo}
            {pendentes[a.id] > 0 && <span className={styles.contagem} title="Propostos esperando aprovação">{pendentes[a.id]}</span>}
          </Link>
        ))}
      </nav>
      {aba === "assuntos"
        ? <GerenciarAssuntos assuntos={assuntos ?? []} />
        : !dados
        ? <p className={`${estilos.card} p-4 text-sm text-ink`}>A classificação fina ainda não foi ativada no banco.</p>
        : <GerenciarClassificacao aba={aba} assuntos={assuntos ?? []} dados={dados} />}
    </PageLayout>
  );
}
