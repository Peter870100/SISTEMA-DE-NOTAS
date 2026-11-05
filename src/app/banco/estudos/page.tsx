import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listaDeEstudos } from "@/lib/estudos/dados";
import { PageLayout } from "@/components/layout/PageLayout";
import { PainelEstudos, FILTROS, type FiltroEstudos } from "@/components/estudos/PainelEstudos";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Estudos do banco por matéria. Todo professor lê; o dono vê também o que pede atenção. */
export default async function EstudosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const dono = professor.role === "dono";
  const pedido = um((await searchParams).filtro);
  const filtro = dono ? (FILTROS.find((f) => f.id === pedido)?.id as FiltroEstudos | undefined) ?? null : null;
  const lista = await listaDeEstudos(dono);

  return (
    <PageLayout crumb="Banco de questões" titulo="Estudos" largura="max-w-7xl"
      subtitulo={dono ? "Explicações e exercícios por assunto, com o que pede a sua atenção." : "Explicações e exercícios por assunto. Achou um erro? Avise pelo botão em cada página."}
      acoes={<Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>}>
      <PainelEstudos lista={lista} dono={dono} filtro={filtro} />
    </PageLayout>
  );
}
