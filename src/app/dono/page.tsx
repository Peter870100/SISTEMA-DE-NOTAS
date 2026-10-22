import Link from "next/link";
import { notFound } from "next/navigation";
import { listarEscolas } from "@/actions/dono";
import { getProfessorAtual } from "@/lib/auth";
import { PageLayout } from "@/components/layout/PageLayout";
import base from "@/components/admin/ContasAdmin.module.css";
import { EscolasLista } from "@/components/dono/EscolasLista";
import { PainelResumo, type ItemResumo } from "@/components/ui/PainelResumo";
import { Bot, Building2, CheckCircle2, ShieldCheck, Users, Plus } from "lucide-react";

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
      acoes={<>
        <Link href="/dono/hermes" className={base.secondary}><Bot size={18} aria-hidden="true" />Feito pela Hermes</Link>
        <Link href="/dono/escolas/nova" className={base.primary}><Plus size={18} aria-hidden="true" />Nova escola</Link>
      </>}
    >
      <PainelResumo itens={painel} />
      <EscolasLista escolas={escolas} />
    </PageLayout>
  );
}
