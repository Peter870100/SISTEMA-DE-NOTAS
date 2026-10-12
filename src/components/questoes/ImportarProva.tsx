"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarImportacao, iniciarLeitura, prepararEnvioPagina, registrarPagina } from "@/actions/importacoes";
import { estilos } from "@/components/ui/estilos";
import { CheckCircle2, FileCheck2, FileText, Send, UploadCloud, X } from "lucide-react";
import css from "./ImportarProva.module.css";
import type { Escopo } from "@/lib/types";

const BANCAS = ["ENEM", "UFMS", "UEMS", "UFGD", "Fuvest"];
const MAX_PAGINAS = 60;
const LARGURA_MAX = 1600;

type Pagina = { blob: Blob; largura: number; altura: number };

async function renderizarPdf(arquivo: File, aoAvancar: (feitas: number, total: number) => void): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  if (doc.numPages > MAX_PAGINAS) throw new Error(`O PDF tem ${doc.numPages} páginas; o máximo é ${MAX_PAGINAS}.`);
  const paginas: Pagina[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const escala = Math.min(150 / 72, LARGURA_MAX / base.width);
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar imagem."))), "image/jpeg", 0.8));
    paginas.push({ blob, largura: canvas.width, altura: canvas.height });
    aoAvancar(n, doc.numPages);
  }
  return paginas;
}

async function enviar(url: string, blob: Blob) {
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", blob, "pagina.jpg");
  const r = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "true" } });
  if (!r.ok) throw new Error("Falha ao enviar página.");
}

export function ImportarProva({ escopos }: { escopos: Escopo[] }) {
  const router = useRouter();
  const [escopo, setEscopo] = useState<Escopo>(escopos[0]);
  const [banca, setBanca] = useState("ENEM");
  const [outra, setOutra] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [caderno, setCaderno] = useState("");
  const [prova, setProva] = useState<File | null>(null);
  const [gabarito, setGabarito] = useState<File | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!prova) return;
    setErro(null);
    try {
      setProgresso("Lendo o PDF…");
      setPct(0);
      const paginasProva = await renderizarPdf(prova, (f, t) => { setProgresso(`Preparando prova: página ${f} de ${t}`); setPct(Math.round((25 * f) / t)); });
      const paginasGab = gabarito ? await renderizarPdf(gabarito, (f, t) => { setProgresso(`Preparando gabarito: página ${f} de ${t}`); setPct(25 + Math.round((10 * f) / t)); }) : [];
      const custo = (paginasProva.length * (9000 * 2 + 3000 * 10)) / 1_000_000;
      if (!window.confirm(`São ${paginasProva.length} páginas. Custo estimado da leitura: ≈ US$ ${custo.toFixed(2)}. Continuar?`)) { setProgresso(null); return; }
      const id = await criarImportacao({ escopo, banca: banca === "Outra" ? outra : banca, ano: ano ? Number(ano) : null, caderno });
      const todas = [...paginasProva.map((p, i) => ({ ...p, tipo: "prova" as const, numero: i + 1 })), ...paginasGab.map((p, i) => ({ ...p, tipo: "gabarito" as const, numero: i + 1 }))];
      for (const [i, p] of todas.entries()) {
        setProgresso(`Enviando páginas: ${i + 1} de ${todas.length}`);
        setPct(35 + Math.round((60 * (i + 1)) / todas.length));
        const { signedUrl } = await prepararEnvioPagina(id, p.tipo, p.numero);
        await enviar(signedUrl, p.blob);
        await registrarPagina(id, p.tipo, p.numero, p.largura, p.altura);
      }
      setProgresso("Mandando para a IA…");
      setPct(98);
      await iniciarLeitura(id);
      router.push(`/banco/importacoes/${id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível importar.");
      setProgresso(null);
    }
  }

  const ocupado = progresso !== null;
  const rotuloEnvio = !prova ? "Escolha o PDF da prova" : gabarito ? "Enviar prova e gabarito" : "Enviar só a prova";
  return (
    <form onSubmit={importar} className={css.formulario}>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}

      <section className={css.passo} aria-labelledby="passo-1">
        <h2 id="passo-1" className={css.tituloPasso}><span>1</span>Onde salvar</h2>
        {escopos.length > 1 ? (
          <div className={css.opcoes} role="radiogroup" aria-label="Banco">
            {([["geral", "Banco geral", "Todas as escolas da plataforma"], ["escola", "Minha escola", "Só para o seu colégio"]] as const).filter(([v]) => escopos.includes(v)).map(([v, titulo, desc]) => (
              <label key={v} className={css.opcao}>
                <input type="radio" name="escopo" value={v} checked={escopo === v} onChange={() => setEscopo(v)} />
                <strong>{titulo}</strong><small>{desc}</small>
              </label>
            ))}
          </div>
        ) : <p className={css.info}>{escopo === "geral" ? "Banco geral (todas as escolas)" : "Questões da sua escola"}</p>}
      </section>

      <section className={css.passo} aria-labelledby="passo-2">
        <h2 id="passo-2" className={css.tituloPasso}><span>2</span>Qual é a prova</h2>
        <div className={css.campos}>
          <label className={css.rotulo}>Banca
            <select value={banca} onChange={(e) => setBanca(e.target.value)} className={estilos.input}>
              {[...BANCAS, "Outra"].map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className={css.rotulo}>Ano<input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={estilos.input} /></label>
          <label className={css.rotulo}>Caderno (opcional)<input value={caderno} onChange={(e) => setCaderno(e.target.value)} placeholder="Ex.: 1º dia, Prova 2" className={estilos.input} /></label>
        </div>
        {banca === "Outra" && <label className={css.rotulo}>Nome da banca<input value={outra} onChange={(e) => setOutra(e.target.value)} required className={estilos.input} /></label>}
      </section>

      <section className={css.passo} aria-labelledby="passo-3">
        <h2 id="passo-3" className={css.tituloPasso}><span>3</span>Arquivos</h2>
        <div className={css.arquivos}>
          <CampoArquivo titulo="PDF da prova" etiqueta="Obrigatório" ajuda="O caderno com as questões (até 60 páginas)." arquivo={prova} aoEscolher={setProva} obrigatorio Icone={FileText} desativado={ocupado} />
          <CampoArquivo titulo="PDF do gabarito" etiqueta="Recomendado" ajuda="As respostas. Sem ele, a resposta de cada questão fica em branco." arquivo={gabarito} aoEscolher={setGabarito} Icone={FileCheck2} desativado={ocupado} />
        </div>
        <p className={css.info}>Os dois arquivos vão juntos, num envio só. Se o gabarito estiver no mesmo PDF da prova, envie só a prova.</p>
      </section>

      {progresso && (
        <div role="status" className={css.andamento}>
          <p>{progresso}</p>
          <span className={css.barra}><span style={{ width: `${pct}%` }} /></span>
        </div>
      )}
      <button type="submit" disabled={ocupado || !prova} className={css.enviar}>
        <Send size={20} aria-hidden="true" />{ocupado ? "Enviando…" : rotuloEnvio}
      </button>
    </form>
  );
}

function CampoArquivo({ titulo, etiqueta, ajuda, arquivo, aoEscolher, obrigatorio = false, Icone, desativado }: {
  titulo: string; etiqueta: string; ajuda: string; arquivo: File | null; aoEscolher: (f: File | null) => void;
  obrigatorio?: boolean; Icone: typeof FileText; desativado: boolean;
}) {
  const [arrastando, setArrastando] = useState(false);
  const escolher = (f: File | undefined | null) => { if (f && f.type === "application/pdf") aoEscolher(f); };
  return (
    <div className={css.campoArquivo} data-escolhido={arquivo ? "sim" : undefined} data-arrastando={arrastando ? "sim" : undefined}
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!desativado) escolher(e.dataTransfer.files?.[0]); }}>
      <div className={css.topoArquivo}>
        <span className={css.iconeArquivo} aria-hidden="true">{arquivo ? <CheckCircle2 size={24} /> : <Icone size={24} />}</span>
        <div><strong>{titulo}</strong><span className={obrigatorio ? css.obrigatorio : css.recomendado}>{etiqueta}</span></div>
      </div>
      <p className={css.ajuda}>{ajuda}</p>
      {arquivo ? (
        <div className={css.escolhido}>
          <FileText size={18} aria-hidden="true" /><span title={arquivo.name}>{arquivo.name}</span>
          <small>{arquivo.size < 1024 * 1024 ? `${Math.max(1, Math.round(arquivo.size / 1024))} KB` : `${(arquivo.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`}</small>
          {!desativado && <button type="button" onClick={() => aoEscolher(null)} aria-label={`Remover ${titulo}`}><X size={16} /></button>}
        </div>
      ) : (
        <label className={css.escolher}>
          <UploadCloud size={20} aria-hidden="true" />Escolher arquivo<em>ou arraste o PDF aqui</em>
          <input type="file" accept="application/pdf" required={obrigatorio} disabled={desativado} onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}
