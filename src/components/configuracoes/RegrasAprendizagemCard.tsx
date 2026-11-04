"use client";

import { useState, useTransition } from "react";
import { BookOpenCheck } from "lucide-react";
import { salvarRegrasAprendizagem, voltarRegrasPadrao } from "@/actions/regras-aprendizagem";
import { LIMITES } from "@/lib/plano/regras";
import type { RegrasAprendizagem } from "@/lib/plano/tipos";
import base from "@/components/admin/ContasAdmin.module.css";
import styles from "./ConfiguracoesPainel.module.css";

const CAMPOS = Object.keys(LIMITES) as (keyof RegrasAprendizagem)[];

function comoTextos(r: RegrasAprendizagem): Record<keyof RegrasAprendizagem, string> {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(r[c])])) as Record<keyof RegrasAprendizagem, string>;
}

export function RegrasAprendizagemCard({ regrasIniciais }: { regrasIniciais: RegrasAprendizagem }) {
  const [textos, setTextos] = useState(() => comoTextos(regrasIniciais));
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    const entrada = Object.fromEntries(
      CAMPOS.map((c) => [c, textos[c].trim() === "" ? NaN : Number(textos[c].replace(",", "."))]),
    );
    iniciar(async () => {
      try {
        const r = await salvarRegrasAprendizagem(entrada);
        if (r.ok) setTextos(comoTextos(r.regras));
        setMensagem(r.ok ? { ok: true, texto: "Regras salvas." } : { ok: false, texto: r.erro });
      } catch {
        setMensagem({ ok: false, texto: "Não foi possível salvar as regras." });
      }
    });
  }

  function voltarPadrao() {
    setMensagem(null);
    iniciar(async () => {
      try {
        const r = await voltarRegrasPadrao();
        if (r.ok) setTextos(comoTextos(r.regras));
        setMensagem(r.ok ? { ok: true, texto: "Regras padrão restauradas." } : { ok: false, texto: r.erro });
      } catch {
        setMensagem({ ok: false, texto: "Não foi possível salvar as regras." });
      }
    });
  }

  return (
    <form onSubmit={salvar} className={`${styles.mediaCard} ${base.card}`}>
      <span className={base.icon}><BookOpenCheck size={23} aria-hidden="true" /></span>
      <span className={styles.optionBody}>
        <span className={styles.title}>Recomendações de estudo</span>
        <span className={styles.description}>Quando um conteúdo vira prioridade e como o plano de estudo é montado.</span>
        <span className={styles.regrasGrade}>
          {CAMPOS.map((c) => {
            const { min, max, rotulo, ajuda } = LIMITES[c];
            return (
              <label key={c} className={styles.regrasCampo}>
                <span className={styles.regrasRotulo}>{rotulo}</span>
                <input
                  inputMode="numeric"
                  value={textos[c]}
                  onChange={(e) => setTextos((t) => ({ ...t, [c]: e.target.value }))}
                />
                <span className={styles.regrasLimite}>de {min} a {max}</span>
                <span className={styles.description}>{ajuda}</span>
              </label>
            );
          })}
        </span>
        <span className={styles.mediaLinha}>
          <button type="submit" className={base.primary} disabled={pendente}>{pendente ? "Salvando..." : "Salvar"}</button>
          <button type="button" className={base.secondary} onClick={voltarPadrao} disabled={pendente}>Voltar ao padrão</button>
        </span>
        {mensagem && <span role="status" className={mensagem.ok ? styles.mediaOk : base.error}>{mensagem.texto}</span>}
      </span>
    </form>
  );
}
