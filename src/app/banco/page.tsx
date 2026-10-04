import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Upload, Tags, Database } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeImportar } from "@/lib/questoes/acesso";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";
const POR_PAGINA = 50;

type Filtros = { texto?: string; banca?: string; ano?: string; area?: string; materia?: string; escopo?: string; status?: string; pagina?: string };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BancoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const f: Filtros = { texto: um(bruto.texto), banca: um(bruto.banca), ano: um(bruto.ano), area: um(bruto.area), materia: um(bruto.materia), escopo: um(bruto.escopo), status: um(bruto.status), pagina: um(bruto.pagina) };
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const pagina = Math.max(1, Number(f.pagina) || 1);

  let c = supabase.from("questoes").select("id, banca, ano, caderno, numero, area, materia, enunciado, status, escopo, precisa_revisao, criado_por, escola_id", { count: "exact" });
  // Visibilidade (igual a podeVerQuestao): dono vê tudo; outros veem geral publicadas + da escola
  // (admin: todas da escola; professor: publicadas ou as próprias).
  // Sintaxe PostgREST: or=(and(a,b),and(c,d,or(e,f))). Ids vêm do servidor (uuid), nunca do usuário.
  if (professor.role !== "dono") {
    const daEscola = professor.role === "admin" ? `and(escopo.eq.escola,escola_id.eq.${professor.escola_id})` : `and(escopo.eq.escola,escola_id.eq.${professor.escola_id},or(status.eq.publicada,criado_por.eq.${professor.id}))`;
    c = c.or(`and(escopo.eq.geral,status.eq.publicada),${daEscola}`);
  }
  if (f.texto) c = c.ilike("enunciado", `%${f.texto.replace(/[%_,()*\\]/g, " ")}%`);
  if (f.banca) c = c.eq("banca", f.banca);
  if (f.ano && Number(f.ano)) c = c.eq("ano", Number(f.ano));
  if (f.area && Object.hasOwn(AREAS, f.area)) c = c.eq("area", f.area as keyof typeof AREAS);
  if (f.materia) c = c.eq("materia", f.materia);
  if (f.escopo === "geral" || f.escopo === "escola") c = c.eq("escopo", f.escopo);
  if (f.status === "publicada" || f.status === "revisao") c = c.eq("status", f.status);
  const { data: questoes, count } = await c.order("ano", { ascending: false }).order("numero").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  const query = (extra: Partial<Filtros>) => `/banco?${new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]).toString()}`;
  const total = count ?? 0;

  return (
    <PageLayout crumb="Banco de questões" titulo="Questões" subtitulo={`${total} questão(ões)`} largura="max-w-7xl"
      acoes={<>
        <Link href="/banco/nova" className={estilos.botaoPrimario}><FilePlus2 size={16} aria-hidden="true" /> Nova questão</Link>
        {(podeImportar(professor, "geral") || podeImportar(professor, "escola")) && <Link href="/banco/importar" className={estilos.botaoSecundario}><Upload size={16} aria-hidden="true" /> Importar prova</Link>}
        {professor.role === "dono" && <Link href="/banco/importar-enem" className={estilos.botaoSecundario}><Database size={16} aria-hidden="true" /> Importar ENEM</Link>}
        {professor.role === "dono" && <Link href="/banco/assuntos" className={estilos.botaoSecundario}><Tags size={16} aria-hidden="true" /> Assuntos</Link>}
      </>}>
      <form className={`${estilos.card} grid gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8`} action="/banco">
        <input name="texto" defaultValue={f.texto} placeholder="Buscar no enunciado" aria-label="Buscar" className={`${estilos.input} sm:col-span-2`} />
        <input name="banca" defaultValue={f.banca} placeholder="Banca" aria-label="Banca" className={estilos.input} />
        <input name="ano" defaultValue={f.ano} placeholder="Ano" aria-label="Ano" inputMode="numeric" className={estilos.input} />
        <select name="area" defaultValue={f.area ?? ""} aria-label="Área" className={estilos.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="materia" defaultValue={f.materia ?? ""} aria-label="Matéria" className={estilos.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
        <select name="status" defaultValue={f.status ?? ""} aria-label="Situação" className={estilos.input}><option value="">Situação</option><option value="publicada">Publicadas</option><option value="revisao">Em revisão</option></select>
        <button type="submit" className={estilos.botaoSecundario}>Filtrar</button>
      </form>
      <ul className={`${estilos.card} divide-y divide-line`}>
        {(questoes ?? []).map((q) => (
          <li key={q.id}><Link href={`/banco/questoes/${q.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-sunken">
            <span className="text-xs text-muted">{q.banca} {q.ano ?? ""} {q.caderno} · Nº {q.numero ?? "—"} · {MATERIAS[q.materia as keyof typeof MATERIAS]?.rotulo ?? q.materia} · {q.escopo === "geral" ? "Banco geral" : "Escola"}{q.status === "revisao" ? " · em revisão" : ""}{q.precisa_revisao ? " · ⚠" : ""}</span>
            <span className="line-clamp-2 text-sm text-ink">{q.enunciado.replace(/[*]/g, "") || "(sem texto)"}</span>
          </Link></li>
        ))}
        {(questoes ?? []).length === 0 && <li className="p-6 text-sm text-muted">Nenhuma questão encontrada.</li>}
      </ul>
      <nav aria-label="Páginas" className="flex justify-between">
        {pagina > 1 ? <Link href={query({ pagina: String(pagina - 1) })} className={estilos.botaoSecundario}>← Anteriores</Link> : <span />}
        {pagina * POR_PAGINA < total && <Link href={query({ pagina: String(pagina + 1) })} className={estilos.botaoSecundario}>Próximas →</Link>}
      </nav>
    </PageLayout>
  );
}
