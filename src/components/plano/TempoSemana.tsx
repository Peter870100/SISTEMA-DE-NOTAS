"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarTempoSemana } from "@/actions/plano-estudo";
import { formatarMinutos } from "@/lib/plano/textos";
import { TEMPOS_SEMANA, TEMPO_SEMANA_PADRAO } from "@/lib/plano/regras";
import css from "./PlanoEstudo.module.css";

export function TempoSemana({ minutos, escolhido }: { minutos: number; escolhido: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function escolher(m: number) {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await salvarTempoSemana({ minutos: m });
        if (r.ok) router.refresh();
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível salvar agora.");
      }
    });
  }

  return (
    <div className={css.tempo}>
      <div className={css.chips} role="group" aria-label="Tempo por semana">
        {TEMPOS_SEMANA.map((m) => (
          <button key={m} type="button" className={css.chip} aria-pressed={escolhido && m === minutos} disabled={pendente} onClick={() => escolher(m)}>
            {formatarMinutos(m)}
          </button>
        ))}
      </div>
      {!escolhido && <p className={css.aviso}>Escolha quanto tempo você tem; por enquanto usamos {formatarMinutos(TEMPO_SEMANA_PADRAO)}.</p>}
      {erro && <p role="status" className={css.erro}>{erro}</p>}
    </div>
  );
}
