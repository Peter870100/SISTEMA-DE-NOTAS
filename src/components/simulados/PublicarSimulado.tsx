"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { publicarSimulado } from "@/actions/simulados";
import { estilos } from "@/components/ui/estilos";

export function PublicarSimulado({ simuladoId }: { simuladoId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function publicar() {
    setOcupado(true); setErro(null);
    try { await publicarSimulado(simuladoId); router.push(`/simulados/${simuladoId}`); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível publicar."); setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      <button type="button" onClick={() => void publicar()} disabled={ocupado} className={estilos.botaoPrimario}>{ocupado ? "Publicando…" : "Publicar simulado"}</button>
    </div>
  );
}
