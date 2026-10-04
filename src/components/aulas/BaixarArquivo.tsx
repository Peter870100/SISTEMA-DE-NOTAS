"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { linkDownloadArquivo } from "@/actions/arquivos";
import { estilos } from "@/components/ui/estilos";

export function BaixarArquivo({ arquivoId, rotulo = "Baixar" }: { arquivoId: string; rotulo?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={ocupado} onClick={async () => {
        setOcupado(true); setErro(null);
        try { window.location.href = await linkDownloadArquivo(arquivoId); }
        catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível baixar."); }
        finally { setOcupado(false); }
      }} className={estilos.botaoFantasma}><Download size={14} aria-hidden="true" /> {ocupado ? "Abrindo…" : rotulo}</button>
      {erro && <span role="alert" className="text-xs text-danger">{erro}</span>}
    </span>
  );
}
