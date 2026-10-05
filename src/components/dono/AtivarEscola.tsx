"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { definirEscolaAtiva } from "@/actions/dono";
import { estilos } from "@/components/ui/estilos";

export function AtivarEscola({ escolaId, ativa }: { escolaId: string; ativa: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    const msg = ativa
      ? "Desativar esta escola? Ninguém dela conseguirá entrar até você reativar."
      : "Reativar esta escola?";
    if (!window.confirm(msg)) return;
    setOcupado(true); setErro(null);
    try { await definirEscolaAtiva(escolaId, !ativa); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar."); }
    finally { setOcupado(false); }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={alternar} disabled={ocupado} className={ativa ? estilos.botaoPerigo : estilos.botaoPrimario}>
        {ativa ? "Desativar escola" : "Reativar escola"}
      </button>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
    </div>
  );
}
