"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { criarTreinoDoPlano } from "@/actions/plano-estudo";
import type { ConteudoPlano, EtapaPlano, RegrasAprendizagem } from "@/lib/plano/tipos";
import css from "./PlanoEstudo.module.css";

export function rotuloEtapa(etapa: EtapaPlano, regras: RegrasAprendizagem, aberto: boolean, situacao: ConteudoPlano["situacao"]): string {
  if (aberto) return "Continuar treino";
  if (etapa === "pratica") return situacao === "concluido" ? "Estudar de novo" : `Praticar ${regras.questoesPratica} questões`;
  if (etapa === "diagnostico") return `Fazer diagnóstico (${regras.questoesDiagnostico} questões)`;
  return `Fazer revisão (${regras.questoesRevisao} questões)`;
}

/** Abre o treino do plano em andamento ou cria um novo e entra nele. */
export function BotaoTreinoPlano({ conteudo, etapa, treinoAberto, rotulo, className }: {
  conteudo: string; etapa: EtapaPlano; treinoAberto: string | null; rotulo: string; className?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const classe = className ?? css.botaoPrincipal;

  if (treinoAberto) {
    return <Link href={`/aluno/simulados/${treinoAberto}`} className={classe}><Play size={17} aria-hidden="true" />Continuar treino</Link>;
  }

  function criar() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await criarTreinoDoPlano({ conteudo, etapa });
        if (r.ok) router.push(`/aluno/simulados/${r.simuladoId}`);
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível criar o treino.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={criar} disabled={pendente} className={classe}>
        <Play size={17} aria-hidden="true" />{pendente ? "Montando treino…" : rotulo}
      </button>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}
    </>
  );
}
