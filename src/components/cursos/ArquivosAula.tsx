"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { prepararEnvioArquivo, registrarArquivo, removerArquivo } from "@/actions/arquivos";
import { validarArquivo } from "@/lib/aulas/arquivos";
import type { AulaArquivo, TipoArquivoAula } from "@/lib/types";
import { BaixarArquivo } from "@/components/aulas/BaixarArquivo";
import { estilos } from "@/components/ui/estilos";

/** Envia ao link assinado do Supabase com progresso (XMLHttpRequest para ter onprogress). */
function enviar(url: string, arquivo: File, onProgresso: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", arquivo, arquivo.name);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso(Math.round((100 * e.loaded) / e.total)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo.")));
    xhr.onerror = () => reject(new Error("Falha no envio do arquivo."));
    xhr.send(corpo);
  });
}

export function ArquivosAula({ aulaId, tipo, arquivos }: { aulaId: string; tipo: TipoArquivoAula; arquivos: AulaArquivo[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(lista: FileList | null) {
    if (!lista) return;
    setErro(null);
    for (const arquivo of Array.from(lista)) {
      const invalido = validarArquivo(arquivo.name, arquivo.size);
      if (invalido) { setErro(`${arquivo.name}: ${invalido}`); continue; }
      try {
        setProgresso(0);
        const { signedUrl, storagePath } = await prepararEnvioArquivo(aulaId, tipo, arquivo.name, arquivo.size);
        await enviar(signedUrl, arquivo, setProgresso);
        await registrarArquivo(aulaId, tipo, arquivo.name, arquivo.size, storagePath);
      } catch (e) {
        setErro(`${arquivo.name}: ${e instanceof Error ? e.message : "falha no envio."}`);
      }
    }
    setProgresso(null);
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <ul className="flex flex-col gap-1">
        {arquivos.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <FileText size={15} className="text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink">{a.nome_arquivo}</span>
            <span className="text-xs text-muted">{(a.tamanho_bytes / 1048576).toFixed(1)} MB</span>
            <BaixarArquivo arquivoId={a.id} rotulo="Abrir" />
            <button type="button" aria-label={`Remover ${a.nome_arquivo}`} onClick={async () => { if (window.confirm(`Remover ${a.nome_arquivo}?`)) { await removerArquivo(a.id); router.refresh(); } }} className={`${estilos.botaoFantasma} px-2`}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple className="sr-only" id={`arquivos-${tipo}`} onChange={(e) => void aoEscolher(e.target.files)} />
      <label htmlFor={`arquivos-${tipo}`} className={`${estilos.botaoSecundario} w-fit cursor-pointer`}><Upload size={15} aria-hidden="true" /> Enviar PDF</label>
      {progresso !== null && (
        <div role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} aria-label="Enviando arquivo" className="h-2 w-full max-w-xs overflow-hidden rounded bg-surface-sunken">
          <div className="h-full bg-brand transition-all" style={{ width: `${progresso}%` }} />
        </div>
      )}
    </div>
  );
}
