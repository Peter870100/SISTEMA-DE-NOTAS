import Link from "next/link";
import { ArrowRight, Building2, ChevronDown, Contact, GraduationCap, History, KeyRound, Settings2, Trash2, Users, type LucideIcon } from "lucide-react";
import type { ProfessorRole } from "@/lib/types";
import { ehAdmin } from "@/lib/papeis";
import base from "@/components/admin/ContasAdmin.module.css";
import { MediaAprovacaoCard } from "./MediaAprovacaoCard";
import styles from "./ConfiguracoesPainel.module.css";

type Opcao = { href: string; icon: LucideIcon; titulo: string; descricao: string };
type Grupo = { titulo: string; opcoes: Opcao[] };

export function ConfiguracoesPainel({ role, mediaAprovacao }: { role: ProfessorRole; mediaAprovacao: number }) {
  const grupos: Grupo[] = [
    ...(ehAdmin(role) ? [{
      titulo: "Escola",
      opcoes: [
        { href: "/admin/alunos", icon: Contact, titulo: "Contas de aluno", descricao: "Crie acessos, gerencie senhas e controle as contas dos alunos." },
        { href: "/admin/professores", icon: Users, titulo: "Professores", descricao: "Gerencie sua equipe, os acessos e as turmas de cada professor." },
        { href: "/admin/historico", icon: History, titulo: "Histórico de alterações", descricao: "Acompanhe as alterações de notas realizadas pela equipe." },
        { href: "/admin/lixeira", icon: Trash2, titulo: "Lixeira", descricao: "Revise itens excluídos e restaure o que precisar." },
      ],
    }] : []),
    ...(role === "dono" ? [{
      titulo: "Plataforma",
      opcoes: [
        { href: "/dono", icon: Building2, titulo: "Escolas", descricao: "Crie e acompanhe as escolas da plataforma." },
      ],
    }] : []),
    {
      titulo: "Minha conta",
      opcoes: [
        { href: "/trocar-senha", icon: KeyRound, titulo: "Trocar senha", descricao: "Altere a senha que você usa para entrar." },
      ],
    },
  ];

  return (
    <div className={base.stack}>
      {ehAdmin(role) && (
        <details className={styles.help}>
          <summary>
            <span className={base.icon}><GraduationCap size={24} aria-hidden="true" /></span>
            <span className={styles.helpTitle}><span className={base.eyebrow}>EXPERIÊNCIA DO ALUNO</span><span className={styles.title}>Como ver a plataforma como aluno</span><span className={styles.description}>Veja como criar um acesso de teste para conhecer a área do aluno.</span></span>
            <span className={styles.helpAction}><span className={styles.whenClosed}>Saiba mais</span><span className={styles.whenOpen}>Recolher</span><ChevronDown size={19} aria-hidden="true" /></span>
          </summary>
          <div className={styles.helpContent}>
            <ol>
              <li>Abra <Link href="/admin/alunos">Contas de aluno</Link>, escolha uma turma e crie uma conta, como &quot;Aluno Teste&quot;.</li>
              <li>Guarde a planilha com o usuário e a senha provisória gerados no cadastro.</li>
              <li>Abra uma janela anônima (Ctrl+Shift+N) para continuar conectado à sua conta aqui.</li>
              <li>Na janela anônima, entre pela tela de login com o usuário e a senha do aluno de teste.</li>
            </ol>
            <Link href="/admin/alunos" className={base.primary}>Gerenciar contas de aluno<ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </details>
      )}
      {ehAdmin(role) && <MediaAprovacaoCard mediaInicial={mediaAprovacao} />}
      <div className={styles.groups}>
        {grupos.map((grupo, index) => (
          <section key={grupo.titulo} aria-labelledby={`configuracoes-grupo-${index}`} className={grupo.opcoes.length > 1 ? styles.wideGroup : undefined}>
            <div className={styles.groupHeading}><h2 id={`configuracoes-grupo-${index}`}>{grupo.titulo}</h2><span className={base.count}><Settings2 size={16} aria-hidden="true" />{grupo.opcoes.length} {grupo.opcoes.length === 1 ? "opção" : "opções"}</span></div>
            <ul className={styles.options}>
              {grupo.opcoes.map(({ href, icon: Icon, titulo, descricao }) => (
                <li key={href}>
                  <Link href={href} className={styles.option}>
                    <span className={base.icon}><Icon size={23} aria-hidden="true" /></span>
                    <span className={styles.optionBody}><span className={styles.title}>{titulo}</span><span className={styles.description}>{descricao}</span></span>
                    <span className={styles.arrow}><ArrowRight size={19} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
