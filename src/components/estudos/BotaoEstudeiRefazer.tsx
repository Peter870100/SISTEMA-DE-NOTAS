"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { criarTreinoDoPlano, marcarRevisado } from "@/actions/plano-estudo";
import css from "@/components/plano/PlanoEstudo.module.css";

/** Marca o estudo como feito e já abre o treino de refazer as erradas. */
export function BotaoEstudeiRefazer({ conteudo, className }: { conteudo: string; className?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const classe = className ?? css.botaoPrincipal;

  function iniciarTreino() {
    setErro(null);
    iniciar(async () => {
      try {
        const marcado = await marcarRevisado({ conteudo });
        if (!marcado.ok) {
          setErro(marcado.erro);
          return;
        }
        const r = await criarTreinoDoPlano({ conteudo, etapa: "refazer" });
        if (r.ok) {
          router.push(`/aluno/simulados/${r.simuladoId}`);
        } else {
          setErro(r.erro);
          router.refresh();
        }
      } catch {
        setErro("Não foi possível criar o treino.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={iniciarTreino} disabled={pendente} className={classe}>
        <Play size={17} aria-hidden="true" />{pendente ? "Montando treino…" : "Já estudei, refazer as erradas"}
      </button>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}
    </>
  );
}
