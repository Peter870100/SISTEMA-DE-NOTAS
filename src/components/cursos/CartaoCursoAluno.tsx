import Link from "next/link";
import { ArrowRight, BookOpen, Layers3, Play, UserRound } from "lucide-react";
import type { ResumoCursoAluno } from "@/lib/aulas/consultas";
import { urlCapa } from "@/lib/aulas/capas";
import { ProgressoCurso } from "@/components/aulas/ProgressoCurso";
import { ImagemCapa } from "./ImagemCapa";
import css from "./CartaoCursoAluno.module.css";

export function CartaoCursoAluno({ resumo }: { resumo: ResumoCursoAluno }) {
  const { curso, professor_nome, porcentagem, continuar, qtd_modulos, qtd_aulas } = resumo;
  const progresso = Math.max(0, Math.min(100, Math.round(porcentagem)));
  const href = `/aluno/cursos/${curso.id}`;
  return (
    <article className={`${css.cartao} cartao-interativo`} aria-labelledby={`curso-${curso.id}`}>
      <Link href={href} className={css.capa} aria-label={`Ver curso ${curso.titulo}`}>
        <ImagemCapa src={urlCapa(curso.capa_caminho)} sizes="(max-width: 639px) 100vw, 272px" className={css.imagem} />
        <span className={css.estado}>{progresso === 100 ? "Concluído" : progresso > 0 ? "Em andamento" : "Para começar"}</span>
      </Link>
      <div className={css.conteudo}>
        <div>
          <span className={css.disciplina}><BookOpen size={16} aria-hidden="true" />{curso.disciplina || "Curso"}</span>
          <h2 id={`curso-${curso.id}`} className={css.titulo}><Link href={href}>{curso.titulo}</Link></h2>
          {professor_nome && <p className={css.professor}><UserRound size={16} aria-hidden="true" />Prof. {professor_nome}</p>}
          {curso.descricao && <p className={css.descricao}>{curso.descricao}</p>}
          <div className={css.metadados}>
            <span><Layers3 size={17} aria-hidden="true" />{qtd_modulos} {qtd_modulos === 1 ? "módulo" : "módulos"}</span>
            <span><Play size={16} aria-hidden="true" />{qtd_aulas} {qtd_aulas === 1 ? "aula" : "aulas"}</span>
          </div>
        </div>
        <div className={css.progresso}>
          <p className={css.rotulo}>{progresso === 100 ? "Curso concluído" : "Seu progresso"}</p>
          <ProgressoCurso porcentagem={progresso} rotulo={`Progresso em ${curso.titulo}`} />
        </div>
        {continuar && <div className={css.proximaAula}>
          <p className={css.rotulo}>{progresso > 0 ? "Continue de onde parou" : "Sua primeira aula"}</p>
          <Link href={`/aluno/aulas/${continuar.aula_id}`} className={css.nomeAula}>{continuar.titulo}</Link>
        </div>}
        <div className={css.acoes}>
          {continuar && <Link href={`/aluno/aulas/${continuar.aula_id}`} className={css.continuar}>
            <Play size={18} aria-hidden="true" />{progresso > 0 ? "Continuar estudando" : "Começar a estudar"}<ArrowRight size={18} aria-hidden="true" />
          </Link>}
          <Link href={href} className={css.verCurso}>Ver curso<BookOpen size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}
