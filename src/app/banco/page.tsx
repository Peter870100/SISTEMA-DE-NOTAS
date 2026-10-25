import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Upload, Tags, Database, CheckCircle2, ClipboardList, School, Sparkles, Search, SlidersHorizontal, TriangleAlert, ArrowRight } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import { padraoExato } from "@/lib/questoes/busca";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { SeloHermes } from "@/components/ui/SeloHermes";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import css from "./Banco.module.css";

export const dynamic = "force-dynamic";
const POR_PAGINA = 50;

type Filtros = { texto?: string; banca?: string; ano?: string; area?: string; materia?: string; escopo?: string; status?: string; origem?: string; pagina?: string };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BancoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const f: Filtros = { texto: um(bruto.texto), banca: um(bruto.banca), ano: um(bruto.ano), area: um(bruto.area), materia: um(bruto.materia), escopo: um(bruto.escopo), status: um(bruto.status), origem: um(bruto.origem), pagina: um(bruto.pagina) };
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const pagina = Math.max(1, Number(f.pagina) || 1);

  // Visibilidade (igual a podeVerQuestao): dono vê tudo; outros veem geral publicadas + da escola
  // (admin: todas da escola; professor: publicadas ou as próprias).
  // Sintaxe PostgREST: or=(and(a,b),and(c,d,or(e,f))). Ids vêm do servidor (uuid), nunca do usuário.
  const visibilidade = professor.role === "dono" ? null
    : `and(escopo.eq.geral,status.eq.publicada),${professor.role === "admin" ? `and(escopo.eq.escola,escola_id.eq.${professor.escola_id})` : `and(escopo.eq.escola,escola_id.eq.${professor.escola_id},or(status.eq.publicada,criado_por.eq.${professor.id}))`}`;
  let c = supabase.from("questoes").select("id, banca, ano, caderno, numero, area, materia, enunciado, status, escopo, precisa_revisao, criado_por, escola_id, origem", { count: "exact" });
  if (visibilidade) c = c.or(visibilidade);
  // Números do painel: tudo o que este professor pode ver (sem os filtros da busca).
  const contar = () => {
    const q = supabase.from("questoes").select("id", { count: "exact", head: true });
    return visibilidade ? q.or(visibilidade) : q;
  };
  if (f.texto) c = c.ilike("enunciado", `%${f.texto.replace(/[%_,()*\\]/g, " ")}%`);
  if (f.banca) c = c.ilike("banca", padraoExato(f.banca));
  if (f.ano && Number(f.ano)) c = c.eq("ano", Number(f.ano));
  if (f.area && Object.hasOwn(AREAS, f.area)) c = c.eq("area", f.area as keyof typeof AREAS);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.escopo === "geral" || f.escopo === "escola") c = c.eq("escopo", f.escopo);
  if (f.status === "publicada" || f.status === "revisao") c = c.eq("status", f.status);
  if (f.origem === "ia") c = c.eq("origem", "ia");
  const [{ data: questoes, count }, publicadas, emRevisao, daEscola] = await Promise.all([
    c.order("ano", { ascending: false }).order("numero").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    contar().eq("status", "publicada"),
    contar().eq("status", "revisao"),
    contar().eq("escopo", "escola"),
  ]);

  // Melhor esforço: sem a coluna `criado_via` no banco, a lista só fica sem o selo.
  const { data: origens } = await supabase.from("questoes").select("id, criado_via").in("id", (questoes ?? []).map((q) => q.id));
  const daHermes = new Set((origens ?? []).filter((o) => o.criado_via === "hermes").map((o) => o.id));

  const query = (extra: Partial<Filtros>) => `/banco?${new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]).toString()}`;
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const painel: ItemResumo[] = [
    { rotulo: "Encontradas", valor: total.toLocaleString("pt-BR"), detalhe: "com os filtros atuais", Icone: Search },
    { rotulo: "Publicadas", valor: (publicadas.count ?? 0).toLocaleString("pt-BR"), detalhe: "prontas para simulados", Icone: CheckCircle2 },
    { rotulo: "Em revisão", valor: (emRevisao.count ?? 0).toLocaleString("pt-BR"), detalhe: "aguardando conferência", Icone: TriangleAlert },
    { rotulo: "Da escola", valor: (daEscola.count ?? 0).toLocaleString("pt-BR"), detalhe: "criadas pela sua escola", Icone: School },
  ];

  return (
    <PageLayout crumb="Banco de questões" titulo="Questões" subtitulo={`${total} questão(ões)`} largura="max-w-7xl"
      acoes={<>
        <Link href="/banco/nova" className={estilos.botaoPrimario}><FilePlus2 size={16} aria-hidden="true" /> Nova questão</Link>
        <Link href="/banco/gerar" className={estilos.botaoSecundario}><Sparkles size={16} aria-hidden="true" /> Gerar com IA</Link>
        {(podeImportar(professor, "geral") || podeImportar(professor, "escola")) && <Link href="/banco/importar" className={estilos.botaoSecundario}><Upload size={16} aria-hidden="true" /> Importar prova</Link>}
        {professor.role === "dono" && <Link href="/banco/importar-enem" className={estilos.botaoSecundario}><Database size={16} aria-hidden="true" /> Importar ENEM</Link>}
        {professor.role === "dono" && <Link href="/banco/assuntos" className={estilos.botaoSecundario}><Tags size={16} aria-hidden="true" /> Assuntos</Link>}
      </>}>
      <PainelResumo itens={painel} />
      <form className={css.filtros} action="/banco">
        <h2 className={css.tituloFiltros}><span className={css.icone} aria-hidden="true"><SlidersHorizontal size={20} /></span>Filtrar questões</h2>
        <div className={css.campos}>
          <input name="texto" defaultValue={f.texto} placeholder="Buscar no enunciado" aria-label="Buscar" className={`${estilos.input} ${css.busca}`} />
          <input name="banca" defaultValue={f.banca} placeholder="Banca" aria-label="Banca" className={estilos.input} />
          <input name="ano" defaultValue={f.ano} placeholder="Ano" aria-label="Ano" inputMode="numeric" className={estilos.input} />
          <select name="area" defaultValue={f.area ?? ""} aria-label="Área" className={estilos.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="materia" defaultValue={f.materia ?? ""} aria-label="Matéria" className={estilos.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
          <select name="status" defaultValue={f.status ?? ""} aria-label="Situação" className={estilos.input}><option value="">Situação</option><option value="publicada">Publicadas</option><option value="revisao">Em revisão</option></select>
          <select name="origem" defaultValue={f.origem ?? ""} aria-label="Origem" className={estilos.input}><option value="">Origem</option><option value="ia">Geradas por IA</option></select>
          <button type="submit" className={css.filtrar}><Search size={17} aria-hidden="true" />Filtrar</button>
        </div>
      </form>
      <section aria-labelledby="titulo-questoes" className="flex flex-col gap-3">
        <h2 id="titulo-questoes" className={css.tituloSecao}><ClipboardList size={22} aria-hidden="true" />Questões<span>{total.toLocaleString("pt-BR")}</span></h2>
        {(questoes ?? []).length === 0 ? <p className={css.vazio}>Nenhuma questão encontrada.</p> : (
          <ul className={css.lista}>
            {(questoes ?? []).map((q, i) => (
              <li key={q.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <Link href={`/banco/questoes/${q.id}`} className={`${css.cartao} cartao-interativo`} data-status={q.status}>
                  <div className={css.topo}>
                    <span className={css.numero} data-icone>Nº {q.numero ?? "—"}</span>
                    <span className={css.origem}>{q.banca} {q.ano ?? ""}{q.caderno ? ` · ${q.caderno}` : ""}</span>
                    {daHermes.has(q.id) && <SeloHermes />}
                    {q.origem === "ia" && <span className={css.selo}>IA</span>}
                    {q.status === "revisao" && <span className={css.revisao}>Em revisão</span>}
                    {q.precisa_revisao && <span className={css.alerta} title="Marcada para conferir"><TriangleAlert size={15} aria-hidden="true" />Conferir</span>}
                  </div>
                  <p className={css.enunciado}>{q.enunciado.replace(/[*]/g, "") || "(sem texto)"}</p>
                  <div className={css.rodape}>
                    <span className={css.materia}>{MATERIAS[q.materia as keyof typeof MATERIAS]?.rotulo ?? q.materia ?? "Sem matéria"}</span>
                    <span className={css.escopo}>{q.escopo === "geral" ? "Banco geral" : "Escola"}</span>
                    <span className={css.abrir}>Abrir<ArrowRight size={16} aria-hidden="true" /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <nav aria-label="Páginas" className={css.paginas}>
        {pagina > 1 ? <Link href={query({ pagina: String(pagina - 1) })} className={estilos.botaoSecundario}>← Anteriores</Link> : <span />}
        <span className={css.paginaAtual}>Página {pagina} de {paginas}</span>
        {pagina * POR_PAGINA < total ? <Link href={query({ pagina: String(pagina + 1) })} className={estilos.botaoSecundario}>Próximas →</Link> : <span />}
      </nav>
    </PageLayout>
  );
}
