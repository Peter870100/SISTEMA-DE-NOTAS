import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAlunoAtual } from "@/lib/auth";
import { obterProva, resultadoAluno } from "@/actions/simulados-aluno";
import { questoesParaAluno } from "@/lib/simulados/servidor";
import { situacaoSimulado } from "@/lib/simulados/regras";
import { supabase } from "@/lib/supabase/client";
import { ComecarTentativa } from "@/components/simulados/ComecarTentativa";
import { ProvaAluno } from "@/components/simulados/ProvaAluno";
import { ResultadoAluno } from "@/components/simulados/ResultadoAluno";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function SimuladoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  let prova;
  try { prova = await obterProva(id); }
  catch (e) {
    if (e instanceof Error && e.message.includes("não encontrado")) notFound();
    throw e;
  }

  const voltar = <Link href="/aluno/simulados" className="text-sm font-semibold text-brand hover:underline">← Simulados</Link>;

  if (!prova) {
    // obterProva já garantiu que o simulado é visível para este aluno.
    const { data: s } = await supabase.from("simulados").select("*").eq("id", id).maybeSingle();
    if (!s) notFound();
    const situacao = situacaoSimulado(s, new Date());
    return (
      <>
        {voltar}
        <h1 className="font-display text-2xl font-semibold text-ink">{s.titulo}</h1>
        <div className={`${estilos.card} flex flex-col gap-3 p-5`}>
          {s.duracao_min && <p className="text-sm text-muted">Duração: {s.duracao_min} minutos. O tempo começa ao clicar em Começar.</p>}
          {situacao === "aberto" ? <ComecarTentativa simuladoId={id} />
            : situacao === "agendado" ? <p className="text-sm text-ink">Abre em {s.abre_em ? fmt(s.abre_em) : "breve"}.</p>
            : <p className="text-sm text-ink">Encerrado.</p>}
        </div>
      </>
    );
  }

  if (prova.status === "em_andamento") {
    return (
      <>
        {voltar}
        <ProvaAluno key={prova.tentativaId} prova={prova} />
      </>
    );
  }

  const resultado = await resultadoAluno(id);
  if (!resultado) notFound();
  const questoes = resultado.liberado ? await questoesParaAluno(resultado.itens.map((i) => i.questaoId), 1800) : [];
  return (
    <>
      {voltar}
      <h1 className="font-display text-2xl font-semibold text-ink">{prova.simulado.titulo}</h1>
      <ResultadoAluno resultado={resultado} questoes={questoes} />
    </>
  );
}
