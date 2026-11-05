"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { relatarErro } from "@/actions/estudos";
import css from "./PaginaEstudo.module.css";

const LIMITE = 500;

/** "Encontrei um erro": campo opcional de até 500 caracteres. Sobre o texto (sem exercício), atualiza a página ao avisar. */
export function BotaoRelatarErro({ materialId, exercicioId, aoRelatar }: { materialId: string; exercicioId: string | null; aoRelatar?: (saiuDoAr: boolean) => void }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviado, setEnviado] = useState<null | { saiuDoAr: boolean }>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar() {
    setErro(null);
    iniciar(async () => {
      try {
        const texto = mensagem.trim();
        const r = await relatarErro({ materialId, exercicioId, mensagem: texto === "" ? null : texto });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        setEnviado({ saiuDoAr: r.saiuDoAr });
        aoRelatar?.(r.saiuDoAr);
        if (exercicioId === null || !aoRelatar) router.refresh();
      } catch {
        setErro("Não foi possível enviar o aviso.");
      }
    });
  }

  if (enviado) {
    return <p role="status" className={css.obrigado}>{enviado.saiuDoAr ? "Obrigado! Vamos conferir." : "Esse item já foi conferido. Obrigado por avisar!"}</p>;
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={css.botaoErro}>
        <Flag size={14} aria-hidden="true" />Encontrei um erro
      </button>
    );
  }

  return (
    <div className={css.formErro}>
      <label className={css.rotuloCampo}>
        O que está errado? (opcional)
        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={LIMITE} rows={3} disabled={pendente} className={css.campoErro} />
      </label>
      <small className={css.contador}>{mensagem.length}/{LIMITE}</small>
      {erro && <p role="alert" className={css.erro}>{erro}</p>}
      <div className={css.acoesErro}>
        <button type="button" onClick={enviar} disabled={pendente} className={css.botaoSec}>{pendente ? "Enviando…" : "Enviar aviso"}</button>
        <button type="button" onClick={() => setAberto(false)} disabled={pendente} className={css.botaoErro}>Cancelar</button>
      </div>
    </div>
  );
}
