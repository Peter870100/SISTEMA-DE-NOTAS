import { redirect } from "next/navigation";
import { Bot, CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import css from "./Hermes.module.css";

export const dynamic = "force-dynamic";

const SITUACOES = {
  iniciada: { rotulo: "Em andamento", Icone: Clock },
  concluida: { rotulo: "Concluída", Icone: CheckCircle2 },
  erro: { rotulo: "Erro", Icone: TriangleAlert },
} as const;
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function FeitoPelaHermesPage() {
  const p = await getProfessorAtual();
  if (!p) redirect("/login");
  if (p.role !== "dono") redirect("/");

  const { data: registros, error } = await supabase.from("hermes_registro").select("*").order("criado_em", { ascending: false }).limit(200);
  const linhas = error ? [] : (registros ?? []);

  // Só nomes: nunca senha, token ou convite.
  const profIds = [...new Set(linhas.map((r) => r.professor_id).filter((x): x is string => !!x))];
  const escolaIds = [...new Set(linhas.map((r) => r.escola_id).filter((x): x is string => !!x))];
  const [{ data: profs }, { data: escolas }] = await Promise.all([
    profIds.length ? supabase.from("professores").select("id, nome").in("id", profIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    escolaIds.length ? supabase.from("escolas").select("id, nome").in("id", escolaIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const nomeProf = new Map((profs ?? []).map((x) => [x.id, x.nome]));
  const nomeEscola = new Map((escolas ?? []).map((x) => [x.id, x.nome]));

  return (
    <PageLayout crumb="Plataforma" titulo="Feito pela Hermes" subtitulo="As últimas 200 ações da Hermes: quem pediu, onde e como terminou." largura="max-w-6xl">
      {error ? (
        <p className={css.vazio}><Bot size={18} aria-hidden="true" /> O registro da Hermes ainda não está ativo.</p>
      ) : linhas.length === 0 ? (
        <p className={css.vazio}><Bot size={18} aria-hidden="true" /> A Hermes ainda não fez nenhuma ação.</p>
      ) : (
        <ul className={css.lista}>
          {linhas.map((r) => {
            const s = SITUACOES[r.situacao];
            return (
              <li key={r.id} className={css.cartao} data-situacao={r.situacao}>
                <div className={css.topo}>
                  <span className={css.icone} aria-hidden="true"><Bot size={20} /></span>
                  <h3 className={css.ferramenta}>{r.ferramenta}</h3>
                  <span className={css.etiqueta}><s.Icone size={14} aria-hidden="true" />{s.rotulo}</span>
                </div>
                <dl className={css.meta}>
                  <div><dt>Quando</dt><dd>{quando(r.criado_em)}</dd></div>
                  <div><dt>Quem pediu</dt><dd>{r.perfil === "dono" ? "O dono" : (r.professor_id && nomeProf.get(r.professor_id)) || "Professor"}</dd></div>
                  <div><dt>Escola</dt><dd>{(r.escola_id && nomeEscola.get(r.escola_id)) || "—"}</dd></div>
                </dl>
                {r.mensagem && <p className={css.mensagem}>{r.mensagem}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </PageLayout>
  );
}
