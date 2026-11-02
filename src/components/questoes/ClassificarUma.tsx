"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { classificarQuestoes } from "@/actions/classificacao";
import type { Area, Habilidade, Topico } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { CamposClassificacao, type ValorClassificacao } from "./CamposClassificacao";
import styles from "./ClassificarUma.module.css";

type Props = {
  questaoId: string;
  assuntoId: string;
  area: Area;
  topicos: Topico[];
  habilidades: Habilidade[];
  inicial: ValorClassificacao;
  /** Endereço da tela com a questão seguinte (usado por "Salvar e próxima" e "Pular"). */
  proximaHref: string;
  /** Enunciado e alternativas, já montados no servidor. */
  children: ReactNode;
};

/** Uma questão por vez: mostra o conteúdo, os campos de classificação e os botões de seguir. */
export function ClassificarUma({ questaoId, assuntoId, area, topicos, habilidades, inicial, proximaHref, children }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState<ValorClassificacao>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vazio = !valor.topicoId && valor.habilidadeIds.length === 0;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const r = await classificarQuestoes([{ questaoId, topicoId: valor.topicoId, habilidadeIds: valor.habilidadeIds }], "trocar");
      if (r.recusados.length > 0) { setErro(r.recusados[0].motivo); setSalvando(false); return; }
      router.push(proximaHref);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <div className={styles.grade}>
      <section className={`${estilos.card} ${styles.questao}`}>{children}</section>
      <aside className={`${estilos.card} ${styles.painel}`}>
        <CamposClassificacao assuntoId={assuntoId} area={area} topicos={topicos} habilidades={habilidades}
          topicoId={valor.topicoId} habilidadeIds={valor.habilidadeIds} onChange={setValor} desabilitado={salvando} />
        {erro && <p role="alert" className={styles.erro}>{erro}</p>}
        <div className={styles.botoes}>
          <button type="button" onClick={() => void salvar()} disabled={salvando || vazio} className={estilos.botaoPrimario}>{salvando ? "Salvando…" : "Salvar e próxima"}</button>
          <Link href={proximaHref} aria-disabled={salvando} className={estilos.botaoSecundario}>Pular</Link>
        </div>
      </aside>
    </div>
  );
}
