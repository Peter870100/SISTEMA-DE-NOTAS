"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarEscola, gerarCodigoConvite, salvarEscola, type DadosEscola } from "@/actions/dono";
import { DOMINIO_BASE, validarSubdominio } from "@/lib/dominio";
import { hexParaRgb, textoSobre, validarCores } from "@/lib/marca";
import { estilos } from "@/components/ui/estilos";

type Props = {
  modo: "criar" | "editar";
  escolaId?: string;
  slug?: string;
  inicial?: DadosEscola;
};

const VAZIO: DadosEscola = { nome: "", nome_remetente_email: "", slogan: "", cor_principal: "", cor_destaque: "", codigo_convite_professor: "" };
const COR_PADRAO_PRINCIPAL = "#0b3d91";
const COR_PADRAO_DESTAQUE = "#f5d90a";

function CampoCor({ rotulo, valor, padrao, aoMudar }: { rotulo: string; valor: string; padrao: string; aoMudar: (v: string) => void }) {
  const hex6 = /^#[0-9a-f]{6}$/i.test(valor.trim()) ? valor.trim() : padrao;
  return (
    <div>
      <span className={estilos.rotulo}>{rotulo}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" aria-label={`${rotulo} (seletor)`} value={hex6} onChange={(e) => aoMudar(e.target.value)} className="h-10 w-12 cursor-pointer rounded-control border border-line bg-surface p-1" />
        <input aria-label={`${rotulo} (hex)`} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder="#RRGGBB (vazio = padrão)" className={estilos.input} maxLength={7} />
      </div>
    </div>
  );
}

export function FormEscola({ modo, escolaId, slug, inicial }: Props) {
  const router = useRouter();
  const [d, setD] = useState<DadosEscola>(inicial ?? VAZIO);
  const [sub, setSub] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criada, setCriada] = useState<{ escolaId: string; senha: string } | null>(null);

  const set = <K extends keyof DadosEscola>(k: K, v: DadosEscola[K]) => setD((x) => ({ ...x, [k]: v }));
  const principal = d.cor_principal.trim() || null;
  const destaque = d.cor_destaque.trim() || null;
  const cores = validarCores(principal, destaque);
  const erroSub = modo === "criar" && sub ? validarSubdominio(sub.trim()) : null;
  const fundo = principal && hexParaRgb(principal) ? principal : COR_PADRAO_PRINCIPAL;
  const fundoBotao = destaque && hexParaRgb(destaque) ? destaque : COR_PADRAO_DESTAQUE;

  async function gerar() {
    try { set("codigo_convite_professor", await gerarCodigoConvite()); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível gerar o código."); }
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setOcupado(true); setErro(null); setAviso(null);
    try {
      if (modo === "criar") {
        const r = await criarEscola(sub.trim(), d, { nome: adminNome, email: adminEmail });
        setCriada({ escolaId: r.escolaId, senha: r.senhaProvisoria });
      } else {
        await salvarEscola(escolaId!, d);
        setAviso("Alterações salvas.");
        router.refresh();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }

  if (criada) {
    return (
      <div className={`${estilos.card} space-y-3 p-5`}>
        <h2 className="font-display text-lg font-semibold text-ink">Escola criada</h2>
        <p className="text-sm text-muted">Senha provisória do primeiro admin ({adminEmail}):</p>
        <p className="select-all rounded-control border border-line bg-surface-sunken px-3 py-2 font-mono text-lg text-ink">{criada.senha}</p>
        <p role="alert" className="text-sm font-semibold text-danger">Copie agora — ela não aparece de novo.</p>
        <Link href={`/dono/escolas/${criada.escolaId}`} className={estilos.botaoPrimario}>Ir para a página da escola</Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className={`${estilos.card} space-y-5 p-5`}>
      <div className="overflow-hidden rounded-card border border-line" aria-label="Prévia da marca">
        <div className="flex items-center justify-between gap-3 px-4 py-4" style={{ background: fundo, color: "#ffffff" }}>
          <span className="font-display text-lg font-semibold">{d.nome.trim() || "Nome da escola"}</span>
          <span className="rounded-control px-3 py-1.5 text-sm font-semibold" style={{ background: fundoBotao, color: textoSobre(fundoBotao) }}>Botão de destaque</span>
        </div>
      </div>

      {modo === "criar" ? (
        <div>
          <label htmlFor="sub" className={estilos.rotulo}>Endereço (subdomínio)</label>
          <div className="mt-1 flex items-center gap-2">
            <input id="sub" required value={sub} onChange={(e) => setSub(e.target.value.toLowerCase())} className={estilos.input} maxLength={30} placeholder="minhaescola" />
            <span className="shrink-0 text-sm text-muted">.{DOMINIO_BASE}</span>
          </div>
          {erroSub && <p role="alert" className="mt-1 text-sm text-danger">{erroSub}</p>}
          <p className="mt-1 text-xs text-muted">Não pode ser alterado depois.</p>
        </div>
      ) : (
        <div>
          <span className={estilos.rotulo}>Endereço</span>
          <p className="mt-1 text-sm text-ink">{slug}.{DOMINIO_BASE}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className={estilos.rotulo}>Nome da escola</label>
          <input id="nome" required value={d.nome} onChange={(e) => set("nome", e.target.value)} className={`${estilos.input} mt-1`} maxLength={120} />
        </div>
        <div>
          <label htmlFor="remetente" className={estilos.rotulo}>Nome do remetente dos e-mails</label>
          <input id="remetente" value={d.nome_remetente_email} onChange={(e) => set("nome_remetente_email", e.target.value)} placeholder="Igual ao nome da escola" className={`${estilos.input} mt-1`} maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="slogan" className={estilos.rotulo}>Slogan</label>
          <input id="slogan" value={d.slogan} onChange={(e) => set("slogan", e.target.value)} className={`${estilos.input} mt-1`} maxLength={160} />
        </div>
        <CampoCor rotulo="Cor principal" valor={d.cor_principal} padrao={COR_PADRAO_PRINCIPAL} aoMudar={(v) => set("cor_principal", v)} />
        <CampoCor rotulo="Cor de destaque" valor={d.cor_destaque} padrao={COR_PADRAO_DESTAQUE} aoMudar={(v) => set("cor_destaque", v)} />
        <div className="sm:col-span-2">
          <button type="button" onClick={() => setD((x) => ({ ...x, cor_principal: "", cor_destaque: "" }))} className={estilos.botaoSecundario}>Usar cores padrão</button>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="codigo" className={estilos.rotulo}>Código de convite dos professores</label>
          <div className="mt-1 flex gap-2">
            <input id="codigo" required value={d.codigo_convite_professor} onChange={(e) => set("codigo_convite_professor", e.target.value)} className={estilos.input} minLength={4} maxLength={50} />
            <button type="button" onClick={gerar} className={estilos.botaoSecundario}>Gerar</button>
          </div>
        </div>
      </div>

      {modo === "criar" && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className={`${estilos.rotulo} mb-2`}>Primeiro admin da escola</legend>
          <div>
            <label htmlFor="adm-nome" className="sr-only">Nome do admin</label>
            <input id="adm-nome" required placeholder="Nome" value={adminNome} onChange={(e) => setAdminNome(e.target.value)} className={estilos.input} />
          </div>
          <div>
            <label htmlFor="adm-email" className="sr-only">E-mail do admin</label>
            <input id="adm-email" required type="email" placeholder="E-mail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={estilos.input} />
          </div>
        </fieldset>
      )}

      {cores.erro && <p role="alert" className="text-sm text-danger">{cores.erro}</p>}
      {cores.alertas.map((a) => <p key={a} role="status" className="text-sm text-muted">{a}</p>)}
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-muted">{aviso}</p>}

      <button type="submit" disabled={ocupado || Boolean(cores.erro) || Boolean(erroSub)} className={estilos.botaoPrimario}>
        {ocupado ? "Salvando…" : modo === "criar" ? "Criar escola" : "Salvar alterações"}
      </button>
    </form>
  );
}
