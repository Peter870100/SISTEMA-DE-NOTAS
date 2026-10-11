import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAlunoAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { obterAulaParaAluno } from "@/lib/aulas/acesso";
import { arvoreDoCurso } from "@/lib/aulas/consultas";
import { gabaritoLiberado, porcentagemAula } from "@/lib/aulas/progresso";
import { AulaAluno } from "@/components/aulas/AulaAluno";
import { BaixarArquivo } from "@/components/aulas/BaixarArquivo";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, FileText, FolderDown, LockKeyhole, Play } from "lucide-react";
import css from "./AulaAlunoPage.module.css";

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
    <div className={css.pagina}>
      <header className={css.cabecalho}>
        <Link href={`/aluno/cursos/${curso.id}`} className={css.voltar}><ArrowLeft size={18} aria-hidden="true" />{curso.titulo}</Link>
        <div className={css.identificacao}><span className={css.icone}><Play size={20} aria-hidden="true" /></span><span>{aula.video_id ? "Videoaula" : "Aula"}{posicao >= 0 && ` · ${posicao + 1} de ${sequencia.length}`}</span></div>
        <h1>{aula.titulo}</h1>
      </header>
      <AulaAluno
        key={aula.id}
        aulaId={aula.id}
        video={aula.video_provedor && aula.video_id ? { provedor: aula.video_provedor, id: aula.video_id } : null}
        iniciarEm={progresso && !concluida ? progresso.posicao_seg : 0}
        porcentagemInicial={porcentagemAula(progresso ?? null)}
        concluidaInicial={concluida}
      />
      <div className={`${css.conteudos} ${aula.texto && (materiais.length > 0 || gabaritos.length > 0) ? css.comMateriais : ""}`}>
        {aula.texto && <section aria-labelledby="titulo-sobre" className={css.secao}>
          <h2 id="titulo-sobre"><BookOpen size={21} aria-hidden="true" />Sobre esta aula</h2>
          <details className={css.expansivel}>
            <summary><span className={css.saibaMais}>Saiba mais</span><span className={css.recolher}>Recolher</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className={css.texto}>{aula.texto}</div>
          </details>
        </section>}
        {(materiais.length > 0 || gabaritos.length > 0) && <div className={css.recursos}>
          {materiais.length > 0 && <section aria-labelledby="titulo-material" className={css.secao}>
            <h2 id="titulo-material"><FolderDown size={21} aria-hidden="true" />Material de apoio</h2>
            <ul className={css.arquivos}>{materiais.map((a) => <li key={a.id}>
              <div className={css.arquivoNome}><FileText size={20} aria-hidden="true" /><span>{a.nome_arquivo}</span></div>
              <BaixarArquivo arquivoId={a.id} />
            </li>)}</ul>
          </section>}
          {gabaritos.length > 0 && <section aria-labelledby="titulo-gabarito" className={css.secao}>
            <h2 id="titulo-gabarito"><FileText size={21} aria-hidden="true" />Gabarito</h2>
            {liberado ? <ul className={css.arquivos}>{gabaritos.map((a) => <li key={a.id}>
              <div className={css.arquivoNome}><FileText size={20} aria-hidden="true" /><span>{a.nome_arquivo}</span></div>
              <BaixarArquivo arquivoId={a.id} />
            </li>)}</ul> : <p className={css.bloqueado}><LockKeyhole size={18} aria-hidden="true" />{avisoGabarito}</p>}
          </section>}
        </div>}
      </div>
      <nav aria-label="Navegação entre aulas" className={css.navegacao}>
        {anterior ? <Link href={`/aluno/aulas/${anterior.id}`} className={css.anterior}><ArrowLeft size={18} aria-hidden="true" />Aula anterior</Link> : <span />}
        {proxima && <Link href={`/aluno/aulas/${proxima.id}`} className={css.proxima}>Próxima aula<ArrowRight size={18} aria-hidden="true" /></Link>}
      </nav>
    </div>
  );
}
