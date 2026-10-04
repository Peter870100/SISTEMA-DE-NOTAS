"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { promoverQuestao } from "@/actions/questoes";
import { estilos } from "@/components/ui/estilos";

export function PromoverQuestao({ questaoId }: { questaoId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button type="button" disabled={ocupado} className={estilos.botaoSecundario} onClick={async () => {
      if (!window.confirm("Copiar esta questão para o banco geral (em revisão)?")) return;
      setOcupado(true);
      try { router.push(`/banco/questoes/${await promoverQuestao(questaoId)}`); }
      catch (e) { window.alert(e instanceof Error ? e.message : "Não foi possível promover."); setOcupado(false); }
    }}>Promover para o banco geral</button>
  );
}
