import Link from "next/link";
import { redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { turmasDoAluno } from "@/lib/aulas/acesso";
import { correcaoLiberada, situacaoSimulado } from "@/lib/simulados/regras";
import type { Simulado, Tentativa } from "@/lib/types";
import { ComecarTentativa } from "@/components/simulados/ComecarTentativa";
import { NovoTreino } from "@/components/simulados/NovoTreino";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Tent = Pick<Tentativa, "simulado_id" | "status" | "porcentagem">;

function Situacao({ s, t, agora }: { s: Simulado; t: Tent | undefined; agora: Date }) {
  if (t?.status === "entregue") {
    const liberada = correcaoLiberada(s, agora);
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink">
        <span>{liberada ? `Entregue · ${Number(t.porcentagem ?? 0).toLocaleString("pt-BR")}%` : `Entregue · correção em ${s.fecha_em ? fmt(s.fecha_em) : "breve"}`}</span>
        <Link href={`/aluno/simulados/${s.id}`} className="font-semibold text-brand hover:underline">Ver resultado</Link>
      </div>
    );
  }
  if (t) return <Link href={`/aluno/simulados/${s.id}`} className={estilos.botaoPrimario}>Continuar</Link>;
  const situacao = situacaoSimulado(s, agora);
  if (situacao === "aberto") return <ComecarTentativa simuladoId={s.id} />;
  if (situacao === "agendado") return <span className="text-sm text-muted">Abre em {s.abre_em ? fmt(s.abre_em) : "breve"}</span>;
  return <span className="text-sm text-muted">Encerrado</span>;
}

export default async function AlunoSimuladosPage() {
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");

  const turmas = await turmasDoAluno(aluno.id);
  const minhas = new Set(turmas.map((t) => `${t.turma_nome}|${t.ano_letivo}`));
  const nomes = [...new Set(turmas.map((t) => t.turma_nome))];

  let daTurma: Simulado[] = [];
  if (nomes.length > 0) {
    const { data: alvos } = await supabase.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").eq("escola_id", aluno.escola_id).in("turma_nome", nomes);
    const ids = [...new Set((alvos ?? []).filter((a) => minhas.has(`${a.turma_nome}|${a.ano_letivo}`)).map((a) => a.simulado_id))];
    if (ids.length > 0) {
      const { data } = await supabase.from("simulados").select("*").in("id", ids).eq("escola_id", aluno.escola_id).eq("tipo", "professor").eq("status", "publicado").order("created_at", { ascending: false });
      daTurma = data ?? [];
    }
  }
  const { data: treinosData } = await supabase.from("simulados").select("*").eq("escola_id", aluno.escola_id).eq("tipo", "treino").eq("conta_id", aluno.id).order("created_at", { ascending: false });
  const treinos = treinosData ?? [];

  const todos = [...daTurma, ...treinos].map((s) => s.id);
  const { data: tentData } = todos.length > 0
    ? await supabase.from("tentativas").select("simulado_id, status, porcentagem").eq("conta_id", aluno.id).in("simulado_id", todos)
    : { data: [] as Tent[] };
  const tentativas = new Map((tentData ?? []).map((t) => [t.simulado_id, t]));
  const agora = new Date();

  return (
    <>
      <div>
        <p className={estilos.rotulo}>Simulados</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Seus simulados</h1>
      </div>

      <section aria-labelledby="titulo-turma" className="flex flex-col gap-3">
        <h2 id="titulo-turma" className="font-semibold text-ink">Da turma</h2>
        {daTurma.length === 0 ? (
          <p className={`${estilos.card} p-5 text-sm text-muted`}>Nenhum simulado da turma por enquanto.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {daTurma.map((s) => (
              <li key={s.id} className={`${estilos.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <div>
                  <p className="font-semibold text-ink">{s.titulo}</p>
                  <p className="text-xs text-muted">{s.duracao_min ? `${s.duracao_min} min` : "Sem limite de tempo"}{s.fecha_em ? ` · fecha em ${fmt(s.fecha_em)}` : ""}</p>
                </div>
                <Situacao s={s} t={tentativas.get(s.id)} agora={agora} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-treinos" className="flex flex-col gap-3">
        <h2 id="titulo-treinos" className="font-semibold text-ink">Meus treinos</h2>
        <NovoTreino />
        {treinos.length > 0 && (
          <ul className="flex flex-col gap-3">
            {treinos.map((s) => (
              <li key={s.id} className={`${estilos.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <div>
                  <p className="font-semibold text-ink">{s.titulo}</p>
                  <p className="text-xs text-muted">{s.duracao_min ? `${s.duracao_min} min` : "Sem tempo"}</p>
                </div>
                <Situacao s={s} t={tentativas.get(s.id)} agora={agora} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
