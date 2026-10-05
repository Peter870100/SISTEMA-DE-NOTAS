import { notFound } from "next/navigation";
import { getProfessorAtual } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { ESCOLA_PADRAO_ID } from "@/lib/escolas";
import { DOMINIO_BASE } from "@/lib/dominio";
import { AtivarEscola } from "@/components/dono/AtivarEscola";
import { EnviarMarca } from "@/components/dono/EnviarMarca";
import { FormEscola } from "@/components/dono/FormEscola";
import { VerificarEndereco } from "@/components/dono/VerificarEndereco";
import { PageLayout } from "@/components/layout/PageLayout";
import { estilos } from "@/components/ui/estilos";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EscolaDonoPage({ params }: PageProps) {
  const p = await getProfessorAtual();
  if (!p || p.role !== "dono") notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: e } = await supabase.from("escolas").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const ehStatus = e.id === ESCOLA_PADRAO_ID;
  const endereco = `${e.slug}.${DOMINIO_BASE}`;

  return (
    <PageLayout crumb="Plataforma" titulo={e.nome} subtitulo={e.ativa ? "Escola ativa" : "Escola desativada"} largura="max-w-3xl">
      <FormEscola
        modo="editar"
        escolaId={e.id}
        slug={e.slug}
        inicial={{
          nome: e.nome,
          nome_remetente_email: e.nome_remetente_email,
          slogan: e.slogan ?? "",
          cor_principal: e.cor_principal ?? "",
          cor_destaque: e.cor_destaque ?? "",
          codigo_convite_professor: e.codigo_convite_professor,
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <EnviarMarca escolaId={e.id} tipo="logo" titulo="Logo" urlAtual={e.logo_url || null} />
        <EnviarMarca escolaId={e.id} tipo="login" titulo="Foto da tela de login" urlAtual={e.foto_login_url} />
      </div>
      {!ehStatus && (
        <section className={`${estilos.card} space-y-3 p-5`}>
          <h2 className="font-display text-lg font-semibold text-ink">Endereço</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>No Registro.br, crie um registro CNAME: <strong>{e.slug}</strong> apontando para <strong>cname.vercel-dns.com</strong>.</li>
            <li>Na Vercel, em Settings → Domains, adicione <strong>{endereco}</strong>.</li>
            <li>Aguarde a propagação e use o botão abaixo para conferir.</li>
          </ol>
          <VerificarEndereco escolaId={e.id} />
        </section>
      )}
      {!ehStatus && (
        <section className={`${estilos.card} space-y-3 p-5`}>
          <h2 className="font-display text-lg font-semibold text-ink">Situação</h2>
          <AtivarEscola escolaId={e.id} ativa={e.ativa} />
        </section>
      )}
    </PageLayout>
  );
}
