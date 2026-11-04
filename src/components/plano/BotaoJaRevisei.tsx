"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { marcarRevisado } from "@/actions/plano-estudo";
import css from "./PlanoEstudo.module.css";

export function BotaoJaRevisei({ conteudo }: { conteudo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function marcar() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await marcarRevisado({ conteudo });
        if (r.ok) router.refresh();
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível salvar agora.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={marcar} disabled={pendente} className={css.botaoSecundario}>
        <Check size={17} aria-hidden="true" />{pendente ? "Salvando…" : "Já revisei"}
      </button>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}
    </>
  );
}
