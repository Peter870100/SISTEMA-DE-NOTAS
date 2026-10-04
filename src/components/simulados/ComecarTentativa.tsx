"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { iniciarTentativa } from "@/actions/simulados-aluno";
import { estilos } from "@/components/ui/estilos";

export function ComecarTentativa({ simuladoId, rotulo = "Começar" }: { simuladoId: string; rotulo?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function comecar() {
    setOcupado(true); setErro(null);
    try { await iniciarTentativa(simuladoId); router.push(`/aluno/simulados/${simuladoId}`); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível começar."); setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <button type="button" onClick={() => void comecar()} disabled={ocupado} className={estilos.botaoPrimario}>{ocupado ? "Abrindo…" : rotulo}</button>
    </div>
  );
}
