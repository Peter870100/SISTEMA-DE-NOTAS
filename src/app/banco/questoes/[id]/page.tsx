import Link from "next/link";
import { Sparkles } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarQuestao, podeVerQuestao } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { LETRAS } from "@/lib/questoes/materias";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { ConteudoQuestao, TextoAlternativa } from "@/components/questoes/ConteudoQuestao";
import { PromoverQuestao } from "@/components/questoes/PromoverQuestao";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function QuestaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Só professores: a visão de leitura mostra a resposta correta. getProfessorAtual é null para alunos.
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  const { data: q } = await supabase.from("questoes").select("*").eq("id", id).maybeSingle();
  if (!q || !podeVerQuestao(professor, q)) notFound();
  const [imagens, { data: assuntos }] = await Promise.all([imagensParaTela([id]), supabase.from("assuntos").select("*").order("nome")]);
  const imgs = imagens.get(id) ?? [];
  const edita = podeEditarQuestao(professor, q);

  return (
    <PageLayout crumb="Banco de questões" titulo={`${q.banca} ${q.ano ?? ""} · Nº ${q.numero ?? "—"}`} largura="max-w-6xl"
      acoes={<>
        <Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>
        <Link href={`/banco/gerar?base=${id}`} className={estilos.botaoSecundario}><Sparkles size={16} aria-hidden="true" /> Gerar parecidas</Link>
        {professor.role === "dono" && q.escopo === "escola" && <PromoverQuestao questaoId={id} />}
      </>}>
      <section className={edita ? undefined : `${estilos.card} p-4`}>
        {edita ? <EditorQuestao questao={q} imagens={imgs} assuntos={assuntos ?? []} podeEscolherGeral={false} /> : (
          <div className="flex flex-col gap-3">
            <ConteudoQuestao doc={q.conteudo ?? null} textoAntigo={q.enunciado} imagens={imgs} />
            <p className="text-sm font-medium text-ink">{q.comando}</p>
            <ol className="flex flex-col gap-2">{LETRAS.map((l) => (
              <li key={l} className={`rounded-control border p-2 text-sm ${q.resposta === l ? "border-ok bg-ok/10" : "border-line"}`}>
                <strong>{l})</strong> {(() => { const alt = q.alternativas.find((a) => a.letra === l); return <TextoAlternativa doc={alt?.conteudo ?? null} texto={alt?.texto ?? ""} />; })()}
                {imgs.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
              </li>
            ))}</ol>
            {q.anulada && <p className="text-sm text-danger">Questão anulada.</p>}
            {q.resolucao && <div className="rounded-control border border-line p-3"><h3 className="text-sm font-semibold text-ink">Resolução comentada</h3><p className="mt-1 whitespace-pre-wrap text-sm text-ink">{q.resolucao}</p></div>}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
