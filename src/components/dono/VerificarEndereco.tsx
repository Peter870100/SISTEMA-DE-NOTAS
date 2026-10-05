"use client";

import { useState } from "react";
import { verificarEndereco } from "@/actions/dono";
import { estilos } from "@/components/ui/estilos";

export function VerificarEndereco({ escolaId }: { escolaId: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  async function verificar() {
    setOcupado(true);
    try { setOk(await verificarEndereco(escolaId)); }
    catch { setOk(false); }
    finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={verificar} disabled={ocupado} className={estilos.botaoSecundario}>
        {ocupado ? "Verificando…" : "Verificar endereço"}
      </button>
      {ok !== null && (
        <span role="status" className={`text-sm font-semibold ${ok ? "text-ink" : "text-muted"}`}>
          {ok ? "funcionando ✓" : "ainda não — pode levar alguns minutos"}
        </span>
      )}
    </div>
  );
}
