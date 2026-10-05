"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { liberarCorrecao } from "@/actions/simulados";
import { estilos } from "@/components/ui/estilos";

export function LiberarCorrecao({ simuladoId, emAndamento = 0 }: { simuladoId: string; emAndamento?: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function liberar() {
    const aviso = emAndamento > 0 ? ` Ainda há ${emAndamento} aluno(s) fazendo a prova: ao liberar, eles poderão ver o gabarito assim que entregarem.` : "";
    if (!window.confirm(`Liberar a correção agora? Quem já entregou passa a ver o gabarito.${aviso}`)) return;
    setOcupado(true); setErro(null);
    try { await liberarCorrecao(simuladoId); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível liberar."); }
    finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <button type="button" onClick={() => void liberar()} disabled={ocupado} className={estilos.botaoSecundario}>{ocupado ? "Liberando…" : "Liberar correção agora"}</button>
    </div>
  );
}
