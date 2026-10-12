import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { listarTurmasAcessiveis } from "@/actions/turmas";
import { PageLayout } from "@/components/layout/PageLayout";
import { FormSimulado } from "@/components/simulados/FormSimulado";
import { ClipboardList } from "lucide-react";
import css from "@/components/simulados/EditorSimulado.module.css";

export const dynamic = "force-dynamic";

export default async function NovoSimuladoPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const turmas = await listarTurmasAcessiveis();
  const opcoes = [...new Map(turmas.map((t) => [`${t.nome}|${t.ano_letivo}`, { turma_nome: t.nome, ano_letivo: t.ano_letivo }])).values()];

  return (
    <PageLayout crumb="Simulados" titulo="Novo simulado" subtitulo="Defina turmas e prazos; as questões vêm no próximo passo." largura="max-w-4xl">
      <section className={css.card} aria-labelledby="titulo-dados">
        <div className={css.heading}><span className={css.step}><ClipboardList size={24} aria-hidden="true" /></span><div><h2 id="titulo-dados">Dados do simulado</h2><p>Comece pelas turmas e pelos prazos da prova.</p></div></div>
        <FormSimulado turmas={opcoes} />
      </section>
    </PageLayout>
  );
}
