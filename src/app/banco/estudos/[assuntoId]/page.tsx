import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { estudoParaDono, estudoParaTela, type ImagemTela } from "@/lib/estudos/dados";
import type { Bloco } from "@/lib/estudos/blocos";
import { PageLayout } from "@/components/layout/PageLayout";
import { Blocos } from "@/components/estudos/Blocos";
import { BotaoRelatarErro } from "@/components/estudos/BotaoRelatarErro";
import { EditorEstudo } from "@/components/estudos/EditorEstudo";
import { Texto } from "@/components/estudos/Texto";
import { estilos } from "@/components/ui/estilos";
import css from "@/components/estudos/Painel.module.css";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EstudoDoBancoPage({ params }: { params: Promise<{ assuntoId: string }> }) {
  const { assuntoId } = await params;
  const professor = await getProfessorAtual();
  if (!professor) redirect("/login");
  if (!UUID.test(assuntoId)) notFound();
  const voltar = <Link href="/banco/estudos" className={estilos.botaoSecundario}>← Estudos</Link>;

  // O dono vê tudo, com gabarito; só depois da conferência do papel é que `estudoParaDono` é chamado.
  if (professor.role === "dono") {
    const e = await estudoParaDono(assuntoId);
    if (!e) notFound();
    const imagens: Record<string, ImagemTela> = Object.fromEntries(e.imagens.map((i) => [i.id, i]));
    const { material } = e;
    return (
      <PageLayout crumb={e.materiaRotulo} titulo={e.assuntoNome} largura="max-w-7xl" acoes={voltar}
        subtitulo={`Fonte: ${material.fonte === "wikipedia" ? `Wikipédia${material.fonte_titulo ? ` (${material.fonte_titulo})` : ""}` : "IA"} · checagens: ${material.checagens}`}>
        <div className={css.pagina}>
          <section className={css.cartao} aria-label="Como o texto aparece">
            <Blocos blocos={material.blocos as Bloco[]} imagens={imagens} />
          </section>
          <EditorEstudo dados={{
            materialId: material.id,
            situacao: material.situacao,
            motivo: material.motivo,
            checagem: material.checagem,
            amostra: material.amostra,
            lido: material.lido_em !== null,
            blocos: material.blocos as Bloco[],
            imagens: e.imagens,
            exercicios: e.exercicios,
            relatos: e.relatos,
          }} />
        </div>
      </PageLayout>
    );
  }

  // Professor: só o que está no ar, sem gabarito, como o aluno vê.
  const leitura = await estudoParaTela(assuntoId, null, professor.escola_id);
  if (leitura.estado === "sem_material") notFound();
  if (leitura.estado === "em_conferencia") {
    return (
      <PageLayout crumb="Estudos" titulo="Em conferência" largura="max-w-4xl" acoes={voltar}>
        <p className={css.aviso}>Este conteúdo está sendo conferido e volta em breve.</p>
      </PageLayout>
    );
  }
  const estudo = leitura.estudo;
  return (
    <PageLayout crumb={estudo.materiaRotulo} titulo={estudo.assuntoNome} largura="max-w-4xl" acoes={voltar}
      subtitulo={`Leitura de uns ${estudo.minutos} min`}>
      <div className={css.pagina}>
        <section className={css.cartao} aria-label="Explicação">
          <Blocos blocos={estudo.blocos} imagens={estudo.imagens} />
          <BotaoRelatarErro materialId={estudo.materialId} exercicioId={null} />
        </section>
        <section className={css.cartao} aria-labelledby="exs">
          <h2 id="exs">Exercícios ({estudo.exercicios.length})</h2>
          {estudo.exercicios.length === 0 && <p>Nenhum exercício disponível agora.</p>}
          {estudo.exercicios.map((ex) => (
            <div key={ex.id} className={css.exercicio}>
              <p className={css.enunciado}><b>{ex.ordem}. </b><Texto texto={ex.enunciado} /></p>
              {ex.imagem && (
                // eslint-disable-next-line @next/next/no-img-element -- desenho em data URL.
                <img src={ex.imagem.src} alt={ex.imagem.alt} className={css.figura} />
              )}
              <ul className={css.alternativas}>
                {ex.alternativas.map((a) => <li key={a.letra}><b>{a.letra})</b><span><Texto texto={a.texto} /></span></li>)}
              </ul>
              <BotaoRelatarErro materialId={estudo.materialId} exercicioId={ex.id} />
            </div>
          ))}
        </section>
      </div>
    </PageLayout>
  );
}
