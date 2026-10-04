import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { gabaritoLiberado, porcentagemAula } from "@/lib/aulas/progresso";
import { AulaAluno } from "@/components/aulas/AulaAluno";
import { BaixarArquivo } from "@/components/aulas/BaixarArquivo";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

export default async function AlunoAulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aluno = await getAlunoAtual();
  if (!aluno) redirect("/login");
  const acesso = await obterAulaParaAluno(aluno, id);
  if (!acesso) notFound();
  const { aula, curso } = acesso;

  const [{ data: progresso }, { data: arquivos }, modulos] = await Promise.all([
    supabase.from("aula_progresso").select("*").eq("conta_id", aluno.id).eq("aula_id", id).maybeSingle(),
    supabase.from("aula_arquivos").select("id, tipo, nome_arquivo").eq("aula_id", id).order("created_at"),
    arvoreDoCurso(curso.id, true),
  ]);
  const sequencia = modulos.flatMap((m) => m.aulas);
  const posicao = sequencia.findIndex((a) => a.id === id);
  const anterior = posicao > 0 ? sequencia[posicao - 1] : null;
  const proxima = posicao >= 0 && posicao < sequencia.length - 1 ? sequencia[posicao + 1] : null;
  const concluida = !!progresso?.concluida_em;
  const liberado = gabaritoLiberado(aula.gabarito_liberacao, aula.gabarito_libera_em, concluida);
  const materiais = (arquivos ?? []).filter((a) => a.tipo === "material");
  const gabaritos = (arquivos ?? []).filter((a) => a.tipo === "gabarito");
  const avisoGabarito = aula.gabarito_liberacao === "data" && aula.gabarito_libera_em
    ? `Disponível em ${new Date(aula.gabarito_libera_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : "Disponível depois que você concluir a aula";

  return (
    <>
      <div>
        <Link href={`/aluno/cursos/${curso.id}`} className="text-sm text-brand hover:underline">← {curso.titulo}</Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{aula.titulo}</h1>
      </div>
      <AulaAluno
        key={aula.id}
        aulaId={aula.id}
        video={aula.video_provedor && aula.video_id ? { provedor: aula.video_provedor, id: aula.video_id } : null}
        iniciarEm={progresso && !concluida ? progresso.posicao_seg : 0}
        porcentagemInicial={porcentagemAula(progresso ?? null)}
        concluidaInicial={concluida}
      />
      {aula.texto && <section aria-label="Texto da aula" className={`${estilos.card} whitespace-pre-line p-4 text-sm text-ink`}>{aula.texto}</section>}
      {materiais.length > 0 && (
        <section aria-labelledby="titulo-material" className={`${estilos.card} p-4`}>
          <h2 id="titulo-material" className="mb-2 font-semibold text-ink">Material</h2>
          <ul className="flex flex-col gap-1">{materiais.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-ink">{a.nome_arquivo}</span><BaixarArquivo arquivoId={a.id} /></li>)}</ul>
        </section>
      )}
      {gabaritos.length > 0 && (
        <section aria-labelledby="titulo-gabarito" className={`${estilos.card} p-4`}>
          <h2 id="titulo-gabarito" className="mb-2 font-semibold text-ink">Gabarito</h2>
          {liberado ? (
            <ul className="flex flex-col gap-1">{gabaritos.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-ink">{a.nome_arquivo}</span><BaixarArquivo arquivoId={a.id} /></li>)}</ul>
          ) : (
            <p className="text-sm text-muted">{avisoGabarito}</p>
          )}
        </section>
      )}
      <nav aria-label="Navegação entre aulas" className="flex justify-between gap-2">
        {anterior ? <Link href={`/aluno/aulas/${anterior.id}`} className={estilos.botaoSecundario}>← Aula anterior</Link> : <span />}
        {proxima && <Link href={`/aluno/aulas/${proxima.id}`} className={estilos.botaoPrimario}>Próxima aula →</Link>}
      </nav>
    </>
  );
}
