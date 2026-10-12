import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Globe, Lock, School, ShieldCheck, Users } from "lucide-react";
import type { ResumoEscola } from "@/actions/dono";
import { DOMINIO_BASE, SLUG_PADRAO } from "@/lib/dominio";
import base from "@/components/admin/ContasAdmin.module.css";
import styles from "./EscolasLista.module.css";

export function EscolasLista({ escolas }: { escolas: ResumoEscola[] }) {
  return (
    <section aria-labelledby="titulo-escolas" className={base.stack}>
      <div className={`${base.card} ${styles.heading}`}>
        <div className={base.sectionTitle}>
          <span className={base.icon}><Building2 size={23} aria-hidden="true" /></span>
          <div><p className={base.eyebrow}>GESTÃO DA PLATAFORMA</p><h2 id="titulo-escolas">Suas escolas</h2><p>Acompanhe a situação e os números de cada escola.</p></div>
        </div>
        <span className={base.count}><Building2 size={18} aria-hidden="true" />{escolas.length} {escolas.length === 1 ? "escola cadastrada" : "escolas cadastradas"}</span>
      </div>
      {escolas.length === 0 ? (
        <div className={`${base.card} ${base.empty}`}><span className={base.icon}><Building2 size={25} aria-hidden="true" /></span><h2>Sua primeira escola começa aqui</h2><p>Cadastre uma escola para começar a organizar a plataforma.</p><Link href="/dono/escolas/nova" className={base.primary}>Nova escola<ArrowRight size={18} aria-hidden="true" /></Link></div>
      ) : (
        <div className={base.grid}>
          {escolas.map((escola) => (
            <article key={escola.id} className={`${base.professor} ${styles.school}`}>
              <div className={styles.identity}>
                <span className={styles.schoolIcon}><Building2 size={30} aria-hidden="true" /></span>
                <div className={styles.name}><p className={base.eyebrow}>ESCOLA</p><h3><Link href={`/dono/escolas/${escola.id}`}>{escola.nome}</Link></h3></div>
              </div>
              <span className={`${base.accountStatus} ${!escola.ativa ? base.blocked : ""}`}>
                {escola.ativa ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}{escola.ativa ? "Ativa" : "Desativada"}
              </span>
              <div className={styles.address}><Globe size={18} aria-hidden="true" /><span>{escola.slug === SLUG_PADRAO ? `www.${DOMINIO_BASE}` : `${escola.slug}.${DOMINIO_BASE}`}</span></div>
              <dl className={styles.numbers}>
                <div><dt><ShieldCheck size={18} aria-hidden="true" />Professores</dt><dd>{escola.professores.toLocaleString("pt-BR")}</dd></div>
                <div><dt><School size={18} aria-hidden="true" />Turmas</dt><dd>{escola.turmas.toLocaleString("pt-BR")}</dd></div>
                <div><dt><Users size={18} aria-hidden="true" />Contas de aluno</dt><dd>{escola.contas.toLocaleString("pt-BR")}</dd></div>
              </dl>
              <div className={styles.footer}><Link href={`/dono/escolas/${escola.id}`} className={base.primary} aria-label={`Gerenciar ${escola.nome}`}>Gerenciar escola<ArrowRight size={18} aria-hidden="true" /></Link></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
