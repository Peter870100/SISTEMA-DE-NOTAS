import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Timer } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { supabase } from "@/lib/supabase/client";
import { emBlocos, situacaoSimulado, type Situacao } from "@/lib/simulados/regras";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

const ROTULOS: Record<Situacao, string> = { rascunho: "Rascunho", agendado: "Agendado", aberto: "Aberto", encerrado: "Encerrado" };
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export default async function SimuladosPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");

  let consulta = supabase.from("simulados").select("*").eq("escola_id", professor.escola_id).eq("tipo", "professor").order("created_at", { ascending: false });
  if (!ehAdmin(professor.role)) consulta = consulta.eq("professor_id", professor.id);
  const { data: simulados, error } = await consulta;
  if (error) throw new Error(error.message);
  const agora = new Date();

  // Turmas e contagem de alunos por simulado, em lote (sem consulta por item).
  const turmasPorSimulado = new Map<string, string[]>();
  const contagem = new Map<string, { comecaram: number; entregaram: number }>();
  for (const bloco of emBlocos((simulados ?? []).map((s) => s.id), 100)) {
    const { data: alvos, error: eT } = await supabase.from("simulado_turmas").select("simulado_id, turma_nome, ano_letivo").in("simulado_id", bloco).order("turma_nome");
    if (eT) throw new Error(eT.message);
    for (const a of alvos ?? []) turmasPorSimulado.set(a.simulado_id, [...(turmasPorSimulado.get(a.simulado_id) ?? []), `${a.turma_nome} · ${a.ano_letivo}`]);
    for (let de = 0; ; de += 1000) {
      const { data: tents, error: eN } = await supabase.from("tentativas").select("id, simulado_id, status").in("simulado_id", bloco).order("id").range(de, de + 999);
      if (eN) throw new Error(eN.message);
      for (const t of tents ?? []) {
        const c = contagem.get(t.simulado_id) ?? { comecaram: 0, entregaram: 0 };
        c.comecaram++;
        if (t.status === "entregue") c.entregaram++;
        contagem.set(t.simulado_id, c);
      }
      if ((tents ?? []).length < 1000) break;
    }
  }

  return (
    <PageLayout
      crumb="Simulados"
      titulo="Simulados"
      subtitulo="Provas cronometradas com questões do banco, aplicadas às suas turmas."
      acoes={<Link href="/simulados/novo" className={estilos.botaoPrimario}><Plus size={16} aria-hidden="true" /> Novo simulado</Link>}
      largura="max-w-4xl"
    >
      <section aria-labelledby="titulo-lista" className={`${estilos.card} p-4`}>
        <h2 id="titulo-lista" className="sr-only">Simulados</h2>
        {(simulados ?? []).length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted"><Timer size={16} aria-hidden="true" /> Nenhum simulado ainda. Crie o primeiro.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(simulados ?? []).map((s) => (
              <li key={s.id}>
                <Link href={s.status === "publicado" ? `/simulados/${s.id}` : `/simulados/${s.id}/editar`} className="flex items-center justify-between gap-3 rounded-control px-2 py-3 hover:bg-surface-sunken">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{s.titulo}</span>
                    <span className="block text-xs text-muted">{ROTULOS[situacaoSimulado(s, agora)]} · {data(s.abre_em)} até {data(s.fecha_em)}</span>
                    <span className="block text-xs text-muted">
                      {(turmasPorSimulado.get(s.id) ?? []).join(", ") || "Sem turmas"}
                      {s.status === "publicado" && ` · ${contagem.get(s.id)?.entregaram ?? 0}/${contagem.get(s.id)?.comecaram ?? 0} entregaram`}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-brand">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
