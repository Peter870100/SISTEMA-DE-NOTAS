import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { Curso } from "@/lib/types";
import { urlCapa } from "@/lib/aulas/capas";
import { ImagemCapa } from "./ImagemCapa";
type Props = {
  curso: Pick<Curso, "titulo" | "disciplina" | "descricao" | "capa_caminho">;
  href?: string; professorNome?: string | null; porcentagem?: number; modulos?: number; aulas?: number;
};
export function CartaoCurso({ curso, href, professorNome, porcentagem, modulos, aulas }: Props) {
  const progresso = porcentagem === undefined ? undefined : Math.max(0, Math.min(100, Math.round(porcentagem)));
  const conteudo = <>
    <ImagemCapa src={urlCapa(curso.capa_caminho)} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px" className="curso-capa-imagem" />
    <span className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/15" />
    <span className="relative z-10 mt-auto flex w-full flex-col gap-2 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">{curso.disciplina || "Disciplina"}</span>
      <span className="font-display text-lg font-bold leading-tight text-white">{curso.titulo || "Título do curso"}</span>
      {professorNome && <span className="text-xs text-white/80">Prof. {professorNome}</span>}
      {curso.descricao && <span className="line-clamp-2 text-xs leading-relaxed text-white/80">{curso.descricao}</span>}
      {(modulos !== undefined || aulas !== undefined) && <span className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-white">
        {modulos !== undefined && <span className="rounded-full bg-white/15 px-2 py-1">{modulos} {modulos === 1 ? "módulo" : "módulos"}</span>}
        {aulas !== undefined && <span className="rounded-full bg-white/15 px-2 py-1">{aulas} {aulas === 1 ? "aula" : "aulas"}</span>}
      </span>}
      {progresso !== undefined && <span className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs font-semibold text-white"><span>{progresso === 100 ? "Concluído" : "Seu progresso"}</span><span>{progresso}%</span></span>
        <span role="progressbar" aria-label={"Progresso em " + curso.titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso} className="h-1.5 overflow-hidden rounded-full bg-white/25"><span className="block h-full rounded-full bg-gold" style={{ width: progresso + "%" }} /></span>
      </span>}
      <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-control border border-white/25 bg-brand px-3 py-2 text-xs font-semibold text-white"><BookOpen size={14} aria-hidden="true" /> Acessar <ArrowRight size={13} aria-hidden="true" /></span>
    </span>
  </>;
  return href ? <Link href={href} aria-label={"Acessar " + curso.titulo} className="curso-capa">{conteudo}</Link> : <div className="curso-capa curso-capa-previa">{conteudo}</div>;
}
