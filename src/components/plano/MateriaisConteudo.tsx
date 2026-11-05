import Link from "next/link";
import { BookOpen, BookOpenCheck, ExternalLink, ListChecks, PlayCircle } from "lucide-react";
import type { ExtrasConteudo } from "@/lib/plano/extras";
import { formatarMinutos, textoResolucoes, textoSemMaterial } from "@/lib/plano/textos";
import css from "./PlanoEstudo.module.css";

/** Materiais de revisão do conteúdo (aulas, links e resoluções). Na visão da escola, sem link de aula. */
export function MateriaisConteudo({ nome, extras, visao, hrefResolucoes }: {
  nome: string; extras: ExtrasConteudo; visao: "aluno" | "escola"; hrefResolucoes: string | null;
}) {
  const { materiais, resolucoes, estudo } = extras;
  const miolo = estudo && <><BookOpenCheck size={17} aria-hidden="true" /><span>Estudar este conteúdo</span><small>{formatarMinutos(estudo.minutos)}</small></>;
  return (
    <div className={css.materiais}>
      {estudo && (visao === "aluno"
        ? <Link href={`/aluno/estudar/${estudo.assuntoId}`} className={css.material}>{miolo}</Link>
        : <p className={css.semMaterial}>{miolo}</p>)}
      {materiais.length === 0 && !estudo && <p className={css.semMaterial}><BookOpen size={16} aria-hidden="true" />{textoSemMaterial(nome, resolucoes > 0)}</p>}
      {materiais.length > 0 && (
        <ul className={css.listaMateriais}>
          {materiais.map((m) => {
            const miolo = <><PlayCircle size={17} aria-hidden="true" /><span>{m.titulo}</span><small>{formatarMinutos(m.minutos)}</small></>;
            if (!m.href || (m.tipo === "aula" && visao === "escola")) return <li key={m.id}><span className={css.material}>{miolo}</span></li>;
            if (m.tipo === "link") return <li key={m.id}><a href={m.href} target="_blank" rel="noopener noreferrer" className={css.material}>{miolo}<ExternalLink size={14} aria-hidden="true" /></a></li>;
            return <li key={m.id}><Link href={m.href} className={css.material}>{miolo}</Link></li>;
          })}
        </ul>
      )}
      {resolucoes > 0 && (
        hrefResolucoes && visao === "aluno"
          ? <Link href={hrefResolucoes} className={css.material}><ListChecks size={17} aria-hidden="true" /><span>{textoResolucoes(resolucoes)}</span></Link>
          : <p className={css.semMaterial}><ListChecks size={16} aria-hidden="true" />{textoResolucoes(resolucoes)}</p>
      )}
    </div>
  );
}
