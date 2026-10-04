import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormSimulado } from "@/components/simulados/FormSimulado";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function NovoSimuladoPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turmas = await listarTurmasAcessiveis();
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }])).values()];

  return (
    <PageLayout crumb="Simulados" titulo="Novo simulado" subtitulo="Defina turmas e prazos; as questões vêm no próximo passo." largura="max-w-3xl">
      <section className={`${estilos.card} p-4`}>
        <FormSimulado turmas={opcoes} />
      </section>
    </PageLayout>
  );
}
