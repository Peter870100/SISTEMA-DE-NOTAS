"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { criarTreinoDoPlano, marcarRevisado } from "@/actions/plano-estudo";
import css from "@/components/plano/PlanoEstudo.module.css";

/**
 * Botão do refazer na página do estudo. Com `marcarAntes`, marca o estudo como feito e abre o treino;
 * sem, abre o treino aberto ou cria um novo (como BotaoTreinoPlano). É um só componente para o erro
 * continuar na tela quando o router.refresh() troca um caso pelo outro.
 */
export function BotaoEstudeiRefazer({ conteudo, className, marcarAntes = true, treinoAberto = null, rotulo = "Refazer as erradas" }: {
  conteudo: string; className?: string; marcarAntes?: boolean; treinoAberto?: string | null; rotulo?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const classe = className ?? css.botaoPrincipal;

  if (treinoAberto && !marcarAntes) {
    return <Link href={`/aluno/simulados/${treinoAberto}`} className={classe}><Play size={17} aria-hidden="true" />Continuar treino</Link>;
  }

  function iniciarTreino() {
    setErro(null);
    iniciar(async () => {
      let marcado = false;
      try {
        if (marcarAntes) {
          const m = await marcarRevisado({ conteudo });
          if (!m.ok) {
            setErro(m.erro);
            return;
          }
          marcado = true;
        }
        const r = await criarTreinoDoPlano({ conteudo, etapa: "refazer" });
        if (r.ok) {
          router.push(`/aluno/simulados/${r.simuladoId}`);
        } else {
          setErro(r.erro);
          if (marcado) router.refresh();
        }
      } catch {
        setErro("Não foi possível criar o treino.");
        if (marcado) router.refresh();
      }
    });
  }

  return (
    <>
      <button type="button" onClick={iniciarTreino} disabled={pendente} className={classe}>
        <Play size={17} aria-hidden="true" />{pendente ? "Montando treino…" : marcarAntes ? "Já estudei, refazer as erradas" : rotulo}
      </button>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}
    </>
  );
}
