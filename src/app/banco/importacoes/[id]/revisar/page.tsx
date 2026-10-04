import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { linkExibicao } from "@/lib/questoes/storage";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { PaginaComQuadros } from "@/components/questoes/PaginaComQuadros";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; filtro?: string }> };

export default async function RevisarPage({ params, searchParams }: Props) {
  const [{ id }, { q, filtro }] = await Promise.all([params, searchParams]);
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", id).maybeSingle();
  if (!imp || !podeImportar(professor, imp.escopo) || (imp.escopo === "escola" && imp.escola_id !== professor.escola_id && professor.role !== "dono")) notFound();

  const { data: todas } = await supabase.from("questoes").select("*").eq("importacao_id", id).order("numero");
  const lista = (todas ?? []).filter((x) =>
    filtro === "aviso" ? x.precisa_revisao : filtro === "sem-resposta" ? !x.resposta && !x.anulada : filtro === "aprovadas" ? x.status === "publicada" : true);
  const ordenada = [...lista].sort((a, b) => Number(b.precisa_revisao) - Number(a.precisa_revisao) || (a.numero ?? 0) - (b.numero ?? 0));
  const atual = ordenada.find((x) => x.id === q) ?? ordenada.find((x) => x.status === "revisao") ?? ordenada[0];
  const proxima = atual ? ordenada.slice(ordenada.indexOf(atual) + 1).find((x) => x.status === "revisao") : undefined;

  const [imagens, { data: assuntos }, pagina] = await Promise.all([
    imagensParaTela(atual ? [atual.id] : []),
    supabase.from("assuntos").select("*").order("nome"),
    atual?.pagina_id ? supabase.from("importacao_paginas").select("*").eq("id", atual.pagina_id).single().then((r) => r.data) : Promise.resolve(null),
  ]);
  const urlPagina = pagina ? await linkExibicao(pagina.storage_path) : null;
  const imgsAtual = atual ? imagens.get(atual.id) ?? [] : [];
  const base = `/banco/importacoes/${id}/revisar`;
  const filtros = [["", "Todas"], ["aviso", "Precisa de revisão"], ["sem-resposta", "Sem resposta"], ["aprovadas", "Aprovadas"]] as const;

  return (
    <PageLayout crumb={`Revisão · ${imp.banca} ${imp.ano ?? ""} ${imp.caderno}`} titulo="Revisar questões" acoes={<Link href={`/banco/importacoes/${id}`} className={estilos.botaoSecundario}>← Importação</Link>} largura="max-w-7xl">
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        {filtros.map(([v, rotulo]) => <Link key={v} href={v ? `${base}?filtro=${v}` : base} className={(filtro ?? "") === v ? estilos.botaoPrimario : estilos.botaoSecundario}>{rotulo}</Link>)}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_1fr]">
        <ol className={`${estilos.card} max-h-[75vh] overflow-y-auto p-2 text-sm`}>
          {ordenada.map((x) => (
            <li key={x.id}><Link href={`${base}?q=${x.id}${filtro ? `&filtro=${filtro}` : ""}`} aria-current={x.id === atual?.id ? "page" : undefined}
              className={`flex justify-between gap-2 rounded px-2 py-1 ${x.id === atual?.id ? "bg-brand/10 font-semibold" : "hover:bg-surface-sunken"}`}>
              <span>Nº {x.numero ?? "—"}</span>
              <span className="text-xs">{x.status === "publicada" ? "✓" : x.precisa_revisao ? "⚠" : ""}</span>
            </Link></li>
          ))}
          {ordenada.length === 0 && <li className="p-2 text-muted">Nada neste filtro.</li>}
        </ol>
        <section aria-label="Página original" className={`${estilos.card} p-3`}>
          {pagina && urlPagina
            ? <PaginaComQuadros key={atual!.id} url={urlPagina} largura={pagina.largura} altura={pagina.altura} quadros={imgsAtual.filter((i) => i.tipo === "recorte" && i.quadro).map((i) => ({ id: i.id, alvo: i.alvo, quadro: i.quadro! }))} />
            : <p className="text-sm text-muted">Sem página original.</p>}
        </section>
        <section aria-label="Questão copiada" className={`${estilos.card} p-3`}>
          {atual
            ? <EditorQuestao key={atual.id} questao={atual} imagens={imgsAtual} assuntos={assuntos ?? []} podeEscolherGeral={false} modoRevisao proximaHref={proxima ? `${base}?q=${proxima.id}${filtro ? `&filtro=${filtro}` : ""}` : `/banco/importacoes/${id}`} />
            : <p className="text-sm text-muted">Nenhuma questão.</p>}
        </section>
      </div>
    </PageLayout>
  );
}
