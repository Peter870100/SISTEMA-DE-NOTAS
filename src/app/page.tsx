import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { TurmasLista } from "@/components/home/TurmasLista";
import { PageLayout } from "@/components/layout/PageLayout";
import { turmasDaEscola } from "@/lib/escola-acesso";
import { getProfessorAtual } from "@/lib/auth";
import { obterEscola } from "@/lib/escolas";
import { ehAdmin } from "@/lib/papeis";
import { NovaTurma } from "@/components/turmas/NovaTurma";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { situacaoSimulado } from "@/lib/simulados/regras";
import { CalendarCheck, ClipboardList, Timer, Users } from "lucide-react";

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

  // Painel: turmas (cada turma tem uma linha por bimestre), alunos (maior bimestre de cada turma),
  // bimestres em aberto e simulados abertos agora (os do professor; admin vê os da escola).
  const porTurma = new Map<string, number>();
  for (const t of turmas) {
    const chave = `${t.nome.trim().toLocaleLowerCase("pt-BR")}|${t.ano_letivo}`;
    porTurma.set(chave, Math.max(porTurma.get(chave) ?? 0, contagemPorTurma[t.id] ?? 0));
  }
  const totalAlunos = [...porTurma.values()].reduce((a, b) => a + b, 0);
  const bimestresAbertos = turmas.filter((t) => !t.bimestre_encerrado).length;
  let consultaSim = supabase.from("simulados").select("status, abre_em, fecha_em").eq("escola_id", professor.escola_id).eq("tipo", "professor").eq("status", "publicado");
  if (!admin) consultaSim = consultaSim.eq("professor_id", professor.id);
  const { data: sims, error: erroSim } = await consultaSim;
  if (erroSim) throw new Error(erroSim.message);
  const agora = new Date();
  const simuladosAbertos = (sims ?? []).filter((s) => situacaoSimulado(s, agora) === "aberto").length;
  const painel: ItemResumo[] = [
    { rotulo: "Turmas", valor: String(porTurma.size), detalhe: porTurma.size === 1 ? "turma ativa" : "turmas ativas", Icone: ClipboardList },
    { rotulo: "Alunos", valor: String(totalAlunos), detalhe: "nas suas turmas", Icone: Users },
    { rotulo: "Bimestres abertos", valor: String(bimestresAbertos), detalhe: "aceitando notas", Icone: CalendarCheck },
    { rotulo: "Simulados abertos", valor: String(simuladosAbertos), detalhe: "acontecendo agora", Icone: Timer },
  ];
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
          <PainelResumo itens={painel} />
          {admin && <NovaTurma />}
          <TurmasLista turmas={turmas} contagemPorTurma={contagemPorTurma} />
        </div>
      )}
    </PageLayout>
  );
}
