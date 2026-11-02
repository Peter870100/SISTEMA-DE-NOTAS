"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { definirPrerequisitos } from "@/actions/classificacao";
import { buscarPorTexto } from "@/lib/questoes/classificacao";
import { estilos } from "@/components/ui/estilos";
import type { Executar } from "./GerenciarClassificacao";
import styles from "./GerenciarClassificacao.module.css";

/** Tópico para a busca de pré-requisitos; o rótulo traz a matéria e o assunto. */
export type ItemBusca = { id: string; nome: string; rotulo: string };

type Props = {
  topicoId: string;
  /** Ids dos pré-requisitos atuais. */
  atuais: string[];
  /** Todos os tópicos, de qualquer matéria. */
  todos: ItemBusca[];
  executar: Executar;
  ocupado: boolean;
};

/** Pré-requisitos de um tópico ("para X é bom saber Y"): adicionar com busca em qualquer matéria e remover. */
export function PrerequisitosTopico({ topicoId, atuais, todos, executar, ocupado }: Props) {
  const [busca, setBusca] = useState("");
  const porId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);
  const doTopico = useMemo(
    () => atuais.map((id) => porId.get(id)).filter((t): t is ItemBusca => !!t).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [atuais, porId],
  );
  const achados = useMemo(
    () => buscarPorTexto(todos.filter((t) => t.id !== topicoId && !atuais.includes(t.id)), busca),
    [todos, topicoId, atuais, busca],
  );

  async function adicionar(t: ItemBusca) {
    if (await executar(() => definirPrerequisitos(topicoId, [...atuais, t.id]), `“${t.nome}” agora é pré-requisito.`)) setBusca("");
  }

  return (
    <div className={styles.bloco}>
      <h4>Pré-requisitos</h4>
      {doTopico.length === 0
        ? <p className={styles.vazio}>Nenhum pré-requisito.</p>
        : (
          <ul className={styles.fichas}>
            {doTopico.map((t) => (
              <li key={t.id} className={styles.ficha}>
                <span>{t.nome}<small>{t.rotulo}</small></span>
                <button type="button" disabled={ocupado} aria-label={`Remover o pré-requisito ${t.nome}`} className={styles.tirar}
                  onClick={() => void executar(() => definirPrerequisitos(topicoId, atuais.filter((id) => id !== t.id)), `“${t.nome}” não é mais pré-requisito.`)}>
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      <div className={styles.adicionar}>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tópico em qualquer matéria" aria-label="Buscar tópico para pré-requisito" className={estilos.input} />
        {busca.trim() && (
          achados.length === 0
            ? <p className={styles.vazio}>Nenhum tópico encontrado.</p>
            : (
              <ul className={styles.achados}>
                {achados.map((t) => (
                  <li key={t.id}><button type="button" disabled={ocupado} onClick={() => void adicionar(t)}>{t.nome}<small>{t.rotulo}</small></button></li>
                ))}
              </ul>
            )
        )}
      </div>
    </div>
  );
}
