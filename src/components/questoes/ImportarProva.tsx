"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarImportacao, iniciarLeitura, prepararEnvioPagina, registrarPagina } from "@/actions/importacoes";
import { estilos } from "@/components/ui/estilos";
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
  const [erro, setErro] = useState<string | null>(null);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!prova) return;
    setErro(null);
    try {
      setProgresso("Lendo o PDF…");
      const paginasProva = await renderizarPdf(prova, (f, t) => setProgresso(`Preparando prova: página ${f} de ${t}`));
      const paginasGab = gabarito ? await renderizarPdf(gabarito, (f, t) => setProgresso(`Preparando gabarito: página ${f} de ${t}`)) : [];
      const custo = (paginasProva.length * (9000 * 2 + 3000 * 10)) / 1_000_000;
      if (!window.confirm(`São ${paginasProva.length} páginas. Custo estimado da leitura: ≈ US$ ${custo.toFixed(2)}. Continuar?`)) { setProgresso(null); return; }
      const id = await criarImportacao({ escopo, banca: banca === "Outra" ? outra : banca, ano: ano ? Number(ano) : null, caderno });
      const todas = [...paginasProva.map((p, i) => ({ ...p, tipo: "prova" as const, numero: i + 1 })), ...paginasGab.map((p, i) => ({ ...p, tipo: "gabarito" as const, numero: i + 1 }))];
      for (const [i, p] of todas.entries()) {
        setProgresso(`Enviando páginas: ${i + 1} de ${todas.length}`);
        const { signedUrl } = await prepararEnvioPagina(id, p.tipo, p.numero);
        await enviar(signedUrl, p.blob);
        await registrarPagina(id, p.tipo, p.numero, p.largura, p.altura);
      }
      setProgresso("Mandando para a IA…");
      await iniciarLeitura(id);
      router.push(`/banco/importacoes/${id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível importar.");
      setProgresso(null);
    }
  }

  const ocupado = progresso !== null;
  return (
    <form onSubmit={importar} className={`${estilos.card} flex max-w-2xl flex-col gap-3 p-5`}>
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {escopos.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-muted">Banco
          <select value={escopo} onChange={(e) => setEscopo(e.target.value as Escopo)} className={estilos.input}>
            <option value="geral">Banco geral (todas as escolas)</option>
            <option value="escola">Questões da minha escola</option>
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Banca
          <select value={banca} onChange={(e) => setBanca(e.target.value)} className={estilos.input}>
            {[...BANCAS, "Outra"].map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ano<input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Caderno (opcional)<input value={caderno} onChange={(e) => setCaderno(e.target.value)} placeholder="1º dia" className={estilos.input} /></label>
      </div>
      {banca === "Outra" && <label className="flex flex-col gap-1 text-xs text-muted">Nome da banca<input value={outra} onChange={(e) => setOutra(e.target.value)} required className={estilos.input} /></label>}
      <label className="flex flex-col gap-1 text-xs text-muted">PDF da prova<input type="file" accept="application/pdf" required onChange={(e) => setProva(e.target.files?.[0] ?? null)} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">PDF do gabarito (opcional)<input type="file" accept="application/pdf" onChange={(e) => setGabarito(e.target.files?.[0] ?? null)} /></label>
      {progresso && <p role="status" className="text-sm text-muted">{progresso}</p>}
      <button type="submit" disabled={ocupado || !prova} className={estilos.botaoPrimario}>{ocupado ? "Importando…" : "Enviar"}</button>
    </form>
  );
}
