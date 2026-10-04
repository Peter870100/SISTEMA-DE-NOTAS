import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { podeEditarQuestao, podeVerQuestao } from "@/lib/questoes/acesso";
import { imagensParaTela } from "@/lib/questoes/consultas";
import { LETRAS } from "@/lib/questoes/materias";
import { PageLayout } from "@/components/layout/PageLayout";
import { EditorQuestao } from "@/components/questoes/EditorQuestao";
import { ImagemQuestao } from "@/components/questoes/ImagemQuestao";
import { TextoQuestao } from "@/components/questoes/TextoQuestao";
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
    <PageLayout crumb="Banco de questões" titulo={`${q.banca} ${q.ano ?? ""} · Nº ${q.numero ?? "—"}`} largura="max-w-3xl"
      acoes={<>
        <Link href="/banco" className={estilos.botaoSecundario}>← Banco</Link>
        {professor.role === "dono" && q.escopo === "escola" && <PromoverQuestao questaoId={id} />}
      </>}>
      <section className={`${estilos.card} p-4`}>
        {edita ? <EditorQuestao questao={q} imagens={imgs} assuntos={assuntos ?? []} podeEscolherGeral={false} /> : (
          <div className="flex flex-col gap-3">
            <TextoQuestao texto={q.enunciado} />
            {imgs.filter((i) => i.alvo === "enunciado").map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
            <p className="text-sm font-medium text-ink">{q.comando}</p>
            <ol className="flex flex-col gap-2">{LETRAS.map((l) => (
              <li key={l} className={`rounded-control border p-2 text-sm ${q.resposta === l ? "border-ok bg-ok/10" : "border-line"}`}>
                <strong>{l})</strong> {q.alternativas.find((a) => a.letra === l)?.texto}
                {imgs.filter((i) => i.alvo === l).map((i) => <ImagemQuestao key={i.id} imagem={i} />)}
              </li>
            ))}</ol>
            {q.anulada && <p className="text-sm text-danger">Questão anulada.</p>}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
