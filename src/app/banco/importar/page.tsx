import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { podeImportar } from "@/lib/questoes/acesso";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ImportarProva } from "@/components/questoes/ImportarProva";
import { SeloHermes } from "@/components/ui/SeloHermes";
import ui from "@/components/ui/SecaoPainel.module.css";
import { History } from "lucide-react";
import type { Escopo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const escopos = (["geral", "escola"] as Escopo[]).filter((e) => podeImportar(professor, e));
  if (escopos.length === 0) redirect("/banco");
  let consulta = supabase.from("importacoes").select("*").order("created_at", { ascending: false }).limit(20);
  if (professor.role !== "dono") consulta = consulta.eq("escola_id", professor.escola_id);
  // `select("*")` traz `criado_via` quando a coluna existe; sem ela, a lista só fica sem o selo.
  const { data: recentes } = await consulta;

  return (
    <PageLayout crumb="Banco de questões" titulo="Importar prova" subtitulo="A IA lê o PDF em segundo plano; depois você revisa." largura="max-w-6xl">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ImportarProva escopos={escopos} />
        {(recentes ?? []).length > 0 && (
          <section className={ui.cartao} aria-labelledby="t-recentes">
            <h2 id="t-recentes" className={ui.titulo}><span className={ui.icone} aria-hidden="true"><History size={20} /></span>Importações recentes</h2>
            <ul className="flex flex-col gap-2">
              {(recentes ?? []).map((i) => {
                const faixa = i.status === "concluida" ? "boa" : i.status === "erro" ? "baixa" : "media";
                return (
                  <li key={i.id}><Link href={`/banco/importacoes/${i.id}`} className="cartao-interativo flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                    <span className="min-w-0 font-heading text-base font-bold uppercase text-brand">{i.banca} {i.ano ?? ""}{i.criado_via === "hermes" && <> <SeloHermes /></>}{i.caderno ? <span className="block truncate font-sans text-xs font-semibold normal-case text-ink">{i.caderno}</span> : null}</span>
                    <span className={ui.nota} data-faixa={faixa}>{{ enviando: "Enviando", lendo: "Lendo", revisao: "Em revisão", concluida: "Concluída", erro: "Erro" }[i.status]}</span>
                  </Link></li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
