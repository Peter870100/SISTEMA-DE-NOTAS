"use client";

import Link from "next/link";
import { useState } from "react";
import { avancarImportacaoEnem, criarImportacaoEnem, type PassoEnem } from "@/actions/enem";
import { estilos } from "@/components/ui/estilos";

const ANOS = Array.from({ length: 15 }, (_, i) => 2023 - i);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportarEnem() {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [passos, setPassos] = useState<Record<number, PassoEnem | string>>({});
  const [rodando, setRodando] = useState(false);

  async function importar() {
    setRodando(true);
    for (const ano of [...marcados].sort()) {
      try {
        const id = await criarImportacaoEnem(ano);
        let p = await avancarImportacaoEnem(id);
        setPassos((x) => ({ ...x, [ano]: p }));
        while (!p.terminou) {
          if (p.status === "lendo") await espera(20_000);
          p = await avancarImportacaoEnem(id);
          setPassos((x) => ({ ...x, [ano]: p }));
        }
      } catch (e) {
        setPassos((x) => ({ ...x, [ano]: e instanceof Error ? e.message : "Falha." }));
      }
    }
    setRodando(false);
  }

  return (
    <div className={`${estilos.card} flex flex-col gap-3 p-5`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMarcados(new Set(ANOS))} className={estilos.botaoFantasma}>Todos</button>
        {ANOS.map((a) => (
          <label key={a} className="flex items-center gap-1 rounded-control border border-line px-2 py-1 text-sm">
            <input type="checkbox" checked={marcados.has(a)} disabled={rodando} onChange={(e) => { const n = new Set(marcados); if (e.target.checked) n.add(a); else n.delete(a); setMarcados(n); }} /> {a}
          </label>
        ))}
      </div>
      <button type="button" disabled={rodando || marcados.size === 0} onClick={() => void importar()} className={`${estilos.botaoPrimario} w-fit`}>{rodando ? "Importando…" : "Importar anos marcados"}</button>
      <p className="text-xs text-muted">Mantenha esta página aberta durante a importação. Cada ano leva alguns minutos (download + classificação pela IA). Sem a chave da IA, o ano é baixado e matéria e assunto ficam para depois: quando a chave estiver configurada, importe o mesmo ano de novo para classificar.</p>
      <ul className="flex flex-col gap-1 text-sm">
        {Object.entries(passos).map(([ano, p]) => (
          <li key={ano}>
            <strong>{ano}:</strong>{" "}
            {typeof p === "string" ? <span className="text-danger">{p}</span>
              : p.status === "enviando" ? `baixando ${p.feitas} de ${p.total}`
              : p.status === "lendo" ? "classificando matérias e assuntos…"
              : p.semIA ? <>baixado, em revisão · matéria e assunto ficam para quando houver chave da IA · <Link href={`/banco/importacoes/${p.importacaoId}`} className="text-brand hover:underline">ver</Link></>
              : <>concluído · <Link href={`/banco/importacoes/${p.importacaoId}`} className="text-brand hover:underline">ver</Link></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
