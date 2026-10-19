import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { estadoConferencia, paginaVizinha } from "@/lib/questoes/conferencia";
import { linkExibicao } from "@/lib/questoes/storage";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { PaginaComQuadros } from "@/components/questoes/PaginaComQuadros";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; filtro?: string; pagina?: string }> };

export default async function RevisarPage({ params, searchParams }: Props) {
  const [{ id }, { q, filtro: filtroParam, pagina: paginaParam }] = await Promise.all([params, searchParams]);
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: imp } = await supabase.from("importacoes").select("*").eq("id", id).maybeSingle();
  if (!imp || !podeImportar(professor, imp.escopo) || (imp.escopo === "escola" && imp.escola_id !== professor.escola_id && professor.role !== "dono")) notFound();

  // Sem filtro na URL a tela abre em "a conferir".
  const filtro = filtroParam ?? "a-conferir";
  const [{ data: todas }, { data: paginasProva }] = await Promise.all([
    supabase.from("questoes").select("*").eq("importacao_id", id).order("numero"),
    supabase.from("importacao_paginas").select("*").eq("importacao_id", id).eq("tipo", "prova").order("numero"),
  ]);
  const lista = (todas ?? []).filter((x) =>
    filtro === "a-conferir" ? estadoConferencia(x) === "a_conferir"
      : filtro === "falta-imagem" ? estadoConferencia(x) === "falta_imagem"
      : filtro === "conferidas" ? estadoConferencia(x) === "conferida"
      : filtro === "aviso" ? x.precisa_revisao : filtro === "sem-resposta" ? !x.resposta && !x.anulada : filtro === "aprovadas" ? x.status === "publicada" : true);
  const ordenada = [...lista].sort((a, b) => Number(b.precisa_revisao) - Number(a.precisa_revisao) || (a.numero ?? 0) - (b.numero ?? 0));
  const atual = ordenada.find((x) => x.id === q) ?? ordenada.find((x) => x.status === "revisao") ?? ordenada[0];
  // Próxima a conferir na lista atual (depois da atual); sem nenhuma, volta para a importação.
  const proxima = atual ? ordenada.slice(ordenada.indexOf(atual) + 1).find((x) => estadoConferencia(x) === "a_conferir") : undefined;

  // ?pagina= só vale se for página de prova desta importação; senão, a página da questão.
  const paginaId = (paginasProva ?? []).some((p) => p.id === paginaParam) ? paginaParam! : atual?.pagina_id ?? null;
  const [imagens, { data: assuntos }] = await Promise.all([
    imagensParaTela(atual ? [atual.id] : []),
    supabase.from("assuntos").select("*").order("nome"),
  ]);
  const pagina = (paginasProva ?? []).find((p) => p.id === paginaId) ?? (paginaId ? await supabase.from("importacao_paginas").select("*").eq("id", paginaId).eq("importacao_id", id).maybeSingle().then((r) => r.data) : null);
  const urlPagina = pagina ? await linkExibicao(pagina.storage_path) : null;
  const imgsAtual = atual ? imagens.get(atual.id) ?? [] : [];
  const base = `/banco/importacoes/${id}/revisar`;
  const sufixoFiltro = filtroParam ? `&filtro=${filtroParam}` : "";
  const hrefPagina = (pid: string | null) => (pid && atual ? `${base}?q=${atual.id}&pagina=${pid}${sufixoFiltro}` : null);
  const anteriorHref = pagina ? hrefPagina(paginaVizinha(paginasProva ?? [], pagina.id, -1)) : null;
  const seguinteHref = pagina ? hrefPagina(paginaVizinha(paginasProva ?? [], pagina.id, 1)) : null;
  const icones = { a_conferir: ["○", "a conferir"], conferida: ["✓", "conferida"], falta_imagem: ["⚠", "falta imagem"] } as const;
  const filtros = [["a-conferir", "A conferir"], ["falta-imagem", "Falta imagem"], ["conferidas", "Conferidas"], ["todas", "Todas"], ["aviso", "Precisa de revisão"], ["sem-resposta", "Sem resposta"], ["aprovadas", "Aprovadas"]] as const;

  return (
    <PageLayout crumb={`Revisão · ${imp.banca} ${imp.ano ?? ""} ${imp.caderno}`} titulo="Revisar questões" acoes={<Link href={`/banco/importacoes/${id}`} className={estilos.botaoSecundario}>← Importação</Link>} largura="max-w-7xl">
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        {filtros.map(([v, rotulo]) => <Link key={v} href={`${base}?filtro=${v}`} className={filtro === v ? estilos.botaoPrimario : estilos.botaoSecundario}>{rotulo}</Link>)}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_1fr]">
        <ol className={`${estilos.card} max-h-[75vh] overflow-y-auto p-2 text-sm`}>
          {ordenada.map((x) => (
            <li key={x.id}><Link href={`${base}?q=${x.id}${sufixoFiltro}`} aria-current={x.id === atual?.id ? "page" : undefined}
              className={`flex justify-between gap-2 rounded px-2 py-1 ${x.id === atual?.id ? "bg-brand/10 font-semibold" : "hover:bg-surface-sunken"}`}>
              <span>Nº {x.numero ?? "—"}</span>
              <span className="text-xs" role="img" aria-label={icones[estadoConferencia(x)][1]} title={icones[estadoConferencia(x)][1]}>{icones[estadoConferencia(x)][0]}</span>
            </Link></li>
          ))}
          {ordenada.length === 0 && <li className="p-2 text-muted">Nada neste filtro.</li>}
        </ol>
        <section aria-label="Página original" className={`${estilos.card} p-3`}>
          {pagina && urlPagina
            ? <PaginaComQuadros key={`${atual!.id}:${pagina.id}`} url={urlPagina} largura={pagina.largura} altura={pagina.altura} questaoId={atual!.id} paginaId={pagina.id} anteriorHref={anteriorHref} seguinteHref={seguinteHref} quadros={imgsAtual.filter((i) => i.tipo === "recorte" && i.quadro && i.paginaId === pagina.id).map((i) => ({ id: i.id, alvo: i.alvo, quadro: i.quadro! }))} />
            : <p className="text-sm text-muted">Sem página original.</p>}
        </section>
        <section aria-label="Questão copiada" className={`${estilos.card} p-3`}>
          {atual
            ? <EditorQuestao key={atual.id} questao={atual} imagens={imgsAtual} assuntos={assuntos ?? []} podeEscolherGeral={false} modoRevisao proximaHref={proxima ? `${base}?q=${proxima.id}${sufixoFiltro}` : `/banco/importacoes/${id}`} />
            : <p className="text-sm text-muted">Nenhuma questão.</p>}
        </section>
      </div>
    </PageLayout>
  );
}
