import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { podeImportar } from "@/lib/questoes/acesso";
import { supabase } from "@/lib/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ImportarProva } from "@/components/questoes/ImportarProva";
import { estilos } from "@/components/ui/estilos";
import type { Escopo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const escopos = (["geral", "escola"] as Escopo[]).filter((e) => podeImportar(professor, e));
  if (escopos.length === 0) redirect("/banco");
  let consulta = supabase.from("importacoes").select("*").order("created_at", { ascending: false }).limit(20);
  if (professor.role !== "dono") consulta = consulta.eq("escola_id", professor.escola_id);
  const { data: recentes } = await consulta;

  return (
    <PageLayout crumb="Banco de questões" titulo="Importar prova" subtitulo="A IA lê o PDF em segundo plano; depois você revisa." largura="max-w-4xl">
      <ImportarProva escopos={escopos} />
      {(recentes ?? []).length > 0 && (
        <section className={`${estilos.card} p-4`} aria-labelledby="t-recentes">
          <h2 id="t-recentes" className="mb-2 font-semibold text-ink">Importações recentes</h2>
          <ul className="divide-y divide-line text-sm">
            {(recentes ?? []).map((i) => (
              <li key={i.id}><Link href={`/banco/importacoes/${i.id}`} className="flex justify-between gap-2 py-2 hover:text-brand">
                <span>{i.banca} {i.ano ?? ""} {i.caderno}</span>
                <span className="text-muted">{{ enviando: "Enviando", lendo: "Lendo", revisao: "Em revisão", concluida: "Concluída", erro: "Erro" }[i.status]}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  );
}
