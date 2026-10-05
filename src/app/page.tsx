import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { PageLayout } from "@/components/layout/PageLayout";
import { turmasDaEscola } from "@/lib/escola-acesso";
import { getProfessorAtual } from "@/lib/auth";
import { obterEscola } from "@/lib/escolas";
import { ehAdmin } from "@/lib/papeis";
import { NovaTurma } from "@/components/turmas/NovaTurma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const [turmas, escola] = await Promise.all([turmasDaEscola(professor), obterEscola(professor.escola_id)]);

  const contagemPorTurma: Record<string, number> = {};
  const ids = turmas.map((t) => t.id);
  // Páginas de 1000 linhas: o Supabase corta cada resposta nesse limite.
  for (let i = 0; i < ids.length; i += 150) {
    const bloco = ids.slice(i, i + 150);
    for (let de = 0; ; de += 1000) {
      const { data: alunos, error } = await supabase.from("alunos").select("turma_id").in("turma_id", bloco).order("id").range(de, de + 999);
      if (error) throw new Error(error.message);
      for (const a of alunos ?? []) {
        contagemPorTurma[a.turma_id] = (contagemPorTurma[a.turma_id] ?? 0) + 1;
      }
      if ((alunos ?? []).length < 1000) break;
    }
  }

  const admin = ehAdmin(professor.role);
  const primeiroNome = professor.nome.trim().split(/\s+/)[0];

  return (
    <PageLayout
      crumb={`Redação · ${escola.nome}`}
      titulo="Suas turmas"
      subtitulo={primeiroNome ? <><span className="mr-2">Olá, Prof. <strong className="font-heading text-xl font-bold uppercase tracking-[0.025em] text-gold">{primeiroNome}</strong>.</span><span>Escolha uma turma para lançar e acompanhar as notas.</span></> : undefined}
      largura="max-w-6xl"
    >
      {admin && turmas.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Nenhuma turma ainda. Crie a primeira.</p>
          <NovaTurma destaque />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {admin && <NovaTurma />}
          <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
        </div>
      )}
    </PageLayout>
  );
}
