import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { letrasVisiveis, MATERIAS } from "@/lib/questoes/materias";
import { enunciadoNaTela } from "@/lib/questoes/markdown";
import { carregarClassificacaoTela } from "@/lib/questoes/classificacao-pagina";
import { questoesParaClassificar } from "@/lib/questoes/classificacao-servidor";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClassificarUma } from "@/components/questoes/ClassificarUma";
import { ConteudoQuestao, TextoAlternativa } from "@/components/questoes/ConteudoQuestao";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const endereco = (p: Record<string, string | undefined>) =>
  `/banco/classificar?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`;

/** Classificação fina uma questão por vez, seguindo os filtros de matéria e assunto (`q` = última questão vista). */
export default async function ClassificarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const materia = um(bruto.materia) || undefined;
  const assuntoId = um(bruto.assunto) || undefined;
  const soSemTopico = um(bruto.semTopico) === "1";
  const depoisDe = um(bruto.q) || undefined;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const filtroAtual = { materia, assunto: assuntoId, semTopico: soSemTopico ? "1" : undefined };

  const moldura = (corpo: ReactNode) => (
    <PageLayout crumb="Banco de questões" titulo="Classificar questões" largura="max-w-7xl"
      acoes={<Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>}>{corpo}</PageLayout>
  );

  const tela = await carregarClassificacaoTela(null);
  if (!tela) return moldura(<p className={`${estilos.card} p-4 text-sm text-ink`}>A classificação fina ainda não foi ativada no banco.</p>);

  const { data: assuntos } = await supabase.from("assuntos").select("id, materia, nome").order("nome");
  const filtros = (
    <form action="/banco/classificar" className={`${estilos.card} flex flex-wrap items-end gap-3 p-4`}>
      <label className="flex flex-col gap-1 text-xs text-muted">Matéria
        <select name="materia" defaultValue={materia ?? ""} className={estilos.input}>
          <option value="">Todas</option>
          {Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">Assunto
        <select name="assunto" defaultValue={assuntoId ?? ""} className={estilos.input}>
          <option value="">Todos</option>
          {(assuntos ?? []).filter((a) => !materia || a.materia === materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="semTopico" value="1" defaultChecked={soSemTopico} /> Só sem tópico</label>
      <button type="submit" className={estilos.botaoSecundario}>Aplicar</button>
    </form>
  );

  const { questoes, total, classificadas } = await questoesParaClassificar(professor, { materia, assuntoId, soSemTopico, limite: 1, depoisDe });
  const q = questoes[0];
  const progresso = `${classificadas.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} classificadas ${assuntoId ? "neste assunto" : "neste filtro"}`;

  if (!q) {
    return moldura(
      <>
        {filtros}
        <div className={`${estilos.card} flex flex-col items-start gap-2 p-4`}>
          <p className="flex items-center gap-2 text-base font-semibold text-ok"><CheckCircle2 size={20} aria-hidden="true" /> Tudo classificado neste filtro</p>
          <p className="text-sm text-ink">{progresso}.</p>
          {depoisDe && <Link href={endereco(filtroAtual)} className={estilos.botaoSecundario}>Recomeçar do início</Link>}
        </div>
      </>,
    );
  }

  const [imagens, atual] = await Promise.all([imagensParaTela([q.id]), carregarClassificacaoTela(q.id)]);
  const imgs = imagens.get(q.id) ?? [];
  const texto = enunciadoNaTela(q.enunciado, q.comando, Array.isArray(q.conteudo?.content), imgs.some((i) => i.alvo === "enunciado"));

  return moldura(
    <>
      {filtros}
      <p className="text-sm font-semibold text-brand">{progresso}</p>
      <ClassificarUma key={q.id} questaoId={q.id} assuntoId={q.assunto_id!} area={q.area} topicos={tela.topicos} habilidades={tela.habilidades}
        inicial={atual?.atual ?? { topicoId: null, habilidadeIds: [] }} proximaHref={endereco({ ...filtroAtual, q: q.id })}>
        <p className="text-xs font-semibold uppercase text-brand">{q.banca} {q.ano ?? ""} · Nº {q.numero ?? "—"}</p>
        <ConteudoQuestao doc={q.conteudo ?? null} textoAntigo={texto.texto} imagens={imgs} figurasAntes={texto.figurasAntes} />
        {texto.comando && <p className="text-sm font-medium text-ink">{texto.comando}</p>}
        <ol className="flex flex-col gap-2">{letrasVisiveis(q.alternativas, new Set(imgs.map((i) => i.alvo))).map((l) => (
          <li key={l} className={`rounded-control border p-2 text-sm ${q.resposta === l ? "border-ok bg-ok/10" : "border-line"}`}>
            <strong>{l})</strong> {(() => { const alt = q.alternativas.find((a) => a.letra === l); return <TextoAlternativa doc={alt?.conteudo ?? null} texto={alt?.texto ?? ""} />; })()}
            {imgs.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
          </li>
        ))}</ol>
      </ClassificarUma>
    </>,
  );
}
