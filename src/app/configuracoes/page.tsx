import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Contact, History, KeyRound, Trash2, Users, type LucideIcon } from "lucide-react";
import { getProfessorAtual } from "@/lib/auth";
import { ehAdmin } from "@/lib/papeis";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type Opcao = { href: string; icon: LucideIcon; titulo: string; descricao: string };
type Grupo = { titulo: string; opcoes: Opcao[] };

export default async function ConfiguracoesPage() {
  const atual = await getProfessorAtual();
  if (!atual) redirect("/login");

  const grupos: Grupo[] = [
    ...(ehAdmin(atual.role) ? [{
      titulo: "Escola",
      opcoes: [
        { href: "/admin/alunos", icon: Contact, titulo: "Contas de aluno", descricao: "Crie acessos de aluno (usuário e senha provisória), bloqueie contas e gere senhas novas. Use para criar um aluno de teste e entrar na área do aluno." },
        { href: "/admin/professores", icon: Users, titulo: "Professores", descricao: "Contas de professores com acesso à plataforma." },
        { href: "/admin/historico", icon: History, titulo: "Histórico de alterações", descricao: "Todas as notas alteradas por professores, da mais recente para a mais antiga." },
        { href: "/admin/lixeira", icon: Trash2, titulo: "Lixeira", descricao: "Tudo que foi excluído fica aqui até você restaurar ou apagar de vez." },
      ],
    }] : []),
    ...(atual.role === "dono" ? [{
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
    <PageLayout crumb="Configurações" titulo="Configurações" subtitulo="Tudo o que você pode ajustar na plataforma, em um só lugar." largura="max-w-4xl">
      <div className="flex flex-col gap-8">
        {ehAdmin(atual.role) && (
          <section className={`${estilos.card} p-5`}>
            <h2 className="font-heading text-lg font-bold text-ink">Como ver a plataforma como aluno</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              <li>Abra <Link href="/admin/alunos" className="font-semibold text-brand hover:underline">Contas de aluno</Link>, escolha uma turma e crie uma conta (por exemplo, &quot;Aluno Teste&quot;).</li>
              <li>Anote o usuário e a senha provisória que aparecem.</li>
              <li>Abra uma janela anônima (Ctrl+Shift+N), para continuar conectado aqui.</li>
              <li>Na janela anônima, entre pela tela de login com esse usuário e senha.</li>
            </ol>
          </section>
        )}
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <h2 className={estilos.rotulo}>{grupo.titulo}</h2>
            <ul className={`${estilos.card} mt-2 divide-y divide-line`}>
              {grupo.opcoes.map(({ href, icon: Icon, titulo, descricao }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-sunken">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{titulo}</span>
                      <span className="mt-0.5 block text-sm text-muted">{descricao}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-faint" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
