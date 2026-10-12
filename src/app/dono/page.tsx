import Link from "next/link";
import { notFound } from "next/navigation";
import { listarEscolas } from "@/actions/dono";
import { getProfessorAtual } from "@/lib/auth";
import { DOMINIO_BASE, SLUG_PADRAO } from "@/lib/dominio";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import ui from "@/components/ui/SecaoPainel.module.css";
import { Building2, CheckCircle2, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DonoPage() {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") notFound();
  const escolas = await listarEscolas();
  const soma = (campo: "professores" | "contas") => escolas.reduce((t, e) => t + (e[campo] ?? 0), 0);
  const painel: ItemResumo[] = [
    { rotulo: "Escolas", valor: String(escolas.length), detalhe: "na plataforma", Icone: Building2 },
    { rotulo: "Ativas", valor: String(escolas.filter((e) => e.ativa).length), detalhe: "com acesso liberado", Icone: CheckCircle2 },
    { rotulo: "Professores", valor: soma("professores").toLocaleString("pt-BR"), detalhe: "em todas as escolas", Icone: ShieldCheck },
    { rotulo: "Contas de aluno", valor: soma("contas").toLocaleString("pt-BR"), detalhe: "em todas as escolas", Icone: Users },
  ];

  return (
    <PageLayout
      crumb="Plataforma"
      titulo="Escolas"
      subtitulo="Só o dono da plataforma vê esta página. Apenas contagens, nunca dados das escolas."
      largura="max-w-6xl"
      acoes={<Link href="/dono/escolas/nova" className={estilos.botaoPrimario}>Nova escola</Link>}
    >
      <PainelResumo itens={painel} />
      <section aria-labelledby="titulo-escolas" className={ui.cartao}>
        <h2 id="titulo-escolas" className={ui.titulo}><span className={ui.icone} aria-hidden="true"><Building2 size={20} /></span>Escolas<span className={ui.contador}>{escolas.length}</span></h2>
        <div className={ui.rolagem}>
          <table className={`${ui.tabela} min-w-[40rem]`}>
            <thead>
              <tr>
                <th>Escola</th><th>Endereço</th><th>Situação</th>
                <th className={ui.direita}>Professores</th><th className={ui.direita}>Turmas</th><th className={ui.direita}>Contas</th>
              </tr>
            </thead>
            <tbody>
              {escolas.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/dono/escolas/${e.id}`} className="font-heading text-base font-bold uppercase text-brand hover:underline">{e.nome}</Link></td>
                  <td>{e.slug === SLUG_PADRAO ? `www.${DOMINIO_BASE}` : `${e.slug}.${DOMINIO_BASE}`}</td>
                  <td><span className={ui.nota} data-faixa={e.ativa ? "boa" : "baixa"}>{e.ativa ? "Ativa" : "Desativada"}</span></td>
                  <td className={`${ui.num} ${ui.direita}`}>{e.professores}</td>
                  <td className={`${ui.num} ${ui.direita}`}>{e.turmas}</td>
                  <td className={`${ui.num} ${ui.direita}`}>{e.contas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
