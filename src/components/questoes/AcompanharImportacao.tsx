"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { aprovarTodasSemAviso, atualizarImportacao, lerDeNovo, type SituacaoImportacao } from "@/actions/importacoes";
import { estilos } from "@/components/ui/estilos";

export function AcompanharImportacao({ importacaoId, inicial }: { importacaoId: string; inicial: SituacaoImportacao }) {
  const [s, setS] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    try { setS(await atualizarImportacao(importacaoId)); setErro(null); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao atualizar."); }
  }, [importacaoId]);

  useEffect(() => {
    if (s.status !== "lendo") return;
    const t = setInterval(() => void atualizar(), 20_000);
    return () => clearInterval(t);
  }, [s.status, atualizar]);

  const pct = s.total ? Math.round((100 * s.lidas) / s.total) : 0;
  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <section className={`${estilos.card} flex flex-col gap-2 p-4`}>
        {s.status === "lendo" ? (
          <>
            <p className="font-semibold text-ink">Lendo prova… {s.lidas} de {s.total} páginas</p>
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leitura da prova" className="h-2 overflow-hidden rounded bg-surface-sunken"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-muted">Pode fechar esta página; a leitura continua. Ela se atualiza sozinha a cada 20 segundos.</p>
            <button type="button" onClick={() => void atualizar()} className={`${estilos.botaoFantasma} w-fit`}>Atualizar agora</button>
          </>
        ) : (
          <p className="font-semibold text-ink">{s.questoes} questões lidas · {s.status === "concluida" ? "Concluída" : s.status === "revisao" ? "Pronta para revisão" : s.status}</p>
        )}
        <p className="text-xs text-muted">Custo estimado: {s.custoEstimado != null ? `US$ ${Number(s.custoEstimado).toFixed(2)}` : "—"} · Custo real: {s.custoReal != null ? `US$ ${Number(s.custoReal).toFixed(2)}` : "—"}</p>
      </section>
      {s.erros.length > 0 && (
        <section className={`${estilos.card} p-4`}>
          <h2 className="mb-2 font-semibold text-danger">Páginas com erro</h2>
          <ul className="text-sm">{s.erros.map((e) => <li key={e.pagina}>Página {e.pagina}: {e.erro}</li>)}</ul>
          <button type="button" disabled={s.status === "lendo"} onClick={async () => { try { await lerDeNovo(importacaoId); await atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } }} className={`${estilos.botaoSecundario} mt-2`}>Ler de novo</button>
        </section>
      )}
      {s.avisos.length > 0 && (
        <details className={`${estilos.card} p-4 text-sm`}><summary className="cursor-pointer font-semibold text-ink">Avisos ({s.avisos.length})</summary><ul className="mt-2 list-disc pl-5 text-muted">{s.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></details>
      )}
      {(s.status === "revisao" || s.status === "concluida") && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/banco/importacoes/${importacaoId}/revisar`} className={estilos.botaoPrimario}>Revisar</Link>
          {s.status === "revisao" && <button type="button" onClick={async () => { try { const n = await aprovarTodasSemAviso(importacaoId); setAviso(`${n} questão(ões) publicada(s).`); await atualizar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); } }} className={estilos.botaoSecundario}>Aprovar todas sem aviso</button>}
        </div>
      )}
    </div>
  );
}
