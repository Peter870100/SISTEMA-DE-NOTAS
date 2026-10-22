"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { salvarMediaAprovacao } from "@/actions/media-aprovacao";
import base from "@/components/admin/ContasAdmin.module.css";
import styles from "./ConfiguracoesPainel.module.css";

export function MediaAprovacaoCard({ mediaInicial }: { mediaInicial: number }) {
  const [texto, setTexto] = useState(String(mediaInicial).replace(".", ","));
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = await salvarMediaAprovacao(texto);
        setMensagem(r.ok ? { ok: true, texto: "Média salva." } : { ok: false, texto: r.erro });
      } catch {
        setMensagem({ ok: false, texto: "Não foi possível salvar a média." });
      }
    });
  }

  return (
    <form onSubmit={salvar} className={`${styles.mediaCard} ${base.card}`}>
      <span className={base.icon}><Target size={23} aria-hidden="true" /></span>
      <span className={styles.optionBody}>
        <span className={styles.title}>Média para aprovação</span>
        <span className={styles.description}>Usada nos relatórios para calcular quanto falta.</span>
        <span className={styles.mediaLinha}>
          <label>
            Média (0 a 10)
            <input inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Média para aprovação" />
          </label>
          <button type="submit" className={base.primary} disabled={pendente}>{pendente ? "Salvando..." : "Salvar"}</button>
        </span>
        {mensagem && <span role="status" className={mensagem.ok ? styles.mediaOk : base.error}>{mensagem.texto}</span>}
      </span>
    </form>
  );
}
