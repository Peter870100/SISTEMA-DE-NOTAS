"use client";

import { useState, useTransition } from "react";
import { IdCard } from "lucide-react";
import { salvarNomeProva } from "@/app/banco/provas-word/acoes";
import { LIMITE_NOME_PROVA } from "@/lib/folha/editar-prova";
import base from "@/components/admin/ContasAdmin.module.css";
import styles from "./ConfiguracoesPainel.module.css";

/** Apelido do professor na linha "Professor(a)" das provas em Word (vale para todas as provas dele). */
export function NomeProvaCard({ nomeInicial }: { nomeInicial: string }) {
  const [texto, setTexto] = useState(nomeInicial);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = await salvarNomeProva(texto);
        if (r.ok) setTexto(r.nomeProva ?? "");
        setMensagem(r.ok ? { ok: true, texto: "Nome do professor salvo." } : { ok: false, texto: r.erro });
      } catch {
        setMensagem({ ok: false, texto: "Não foi possível salvar o nome do professor." });
      }
    });
  }

  return (
    <form onSubmit={salvar} className={`${styles.mediaCard} ${base.card}`}>
      <span className={base.icon}><IdCard size={23} aria-hidden="true" /></span>
      <span className={styles.optionBody}>
        <span className={styles.title}>Nome ou apelido do professor</span>
        <span className={styles.description}>Vale para todas as suas provas. Em branco, sai o seu nome.</span>
        <span className={`${styles.mediaLinha} ${styles.nomeProvaLinha}`}>
          <label>
            Nome ou apelido do professor
            <input value={texto} maxLength={LIMITE_NOME_PROVA} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Cenoura" />
          </label>
          <button type="submit" className={base.primary} disabled={pendente}>{pendente ? "Salvando..." : "Salvar"}</button>
        </span>
        {mensagem && <span role="status" className={mensagem.ok ? styles.mediaOk : base.error}>{mensagem.texto}</span>}
      </span>
    </form>
  );
}
