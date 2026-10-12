"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { publicarSimulado } from "@/actions/simulados";
import { CheckCircle2 } from "lucide-react";
import base from "@/components/admin/ContasAdmin.module.css";
import css from "./EditorSimulado.module.css";

export function PublicarSimulado({ simuladoId }: { simuladoId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function publicar() {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await publicarSimulado(simuladoId);
      if (!r.ok) { setErro(r.erro); setOcupado(false); return; }
      router.push(`/simulados/${simuladoId}`);
    } catch { setErro("Não foi possível publicar. Verifique a conexão e tente de novo."); setOcupado(false); }
  }

  return (
    <div className={css.publishAction}>
      {erro && <p role="alert" className={base.error}>{erro}</p>}
      <button type="button" onClick={() => void publicar()} disabled={ocupado} className={css.publish}><CheckCircle2 size={19} aria-hidden="true" />{ocupado ? "Publicando…" : "Publicar simulado"}</button>
    </div>
  );
}
