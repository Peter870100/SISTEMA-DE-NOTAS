"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { aprovarAssunto, carregarAssuntosIniciais, juntarAssunto } from "@/actions/assuntos";
import { MATERIAS } from "@/lib/questoes/materias";
import type { Assunto } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";

export function GerenciarAssuntos({ assuntos }: { assuntos: Assunto[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const propostos = assuntos.filter((a) => a.situacao === "proposto");
  const aprovados = assuntos.filter((a) => a.situacao === "aprovado");
  const rotulo = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;

  async function executar<T>(acao: () => Promise<T>, msg: string | ((resultado: T) => string)) {
    setErro(null); setAviso(null);
    try { const r = await acao(); setAviso(typeof msg === "function" ? msg(r) : msg); router.refresh(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <section className={`${estilos.card} p-4`}>
        <h2 className="mb-2 font-semibold text-ink">Propostos pela IA ({propostos.length})</h2>
        {propostos.length === 0 && <p className="text-sm text-muted">Nenhuma proposta.</p>}
        <ul className="divide-y divide-line">
          {propostos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="mr-auto"><strong>{p.nome}</strong> <span className="text-muted">· {rotulo(p.materia)}</span></span>
              <button type="button" onClick={() => void executar(() => aprovarAssunto(p.id), `“${p.nome}” aprovado.`)} className={estilos.botaoSecundario}>Aprovar</button>
              <select value={destinos[p.id] ?? ""} onChange={(e) => setDestinos({ ...destinos, [p.id]: e.target.value })} aria-label={`Juntar ${p.nome} com`} className={`${estilos.input} max-w-56`}>
                <option value="">Juntar com…</option>
                {aprovados.filter((a) => a.materia === p.materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <button type="button" disabled={!destinos[p.id]} onClick={() => void executar(() => juntarAssunto(p.id, destinos[p.id]), "Assuntos juntados.")} className={estilos.botaoFantasma}>Juntar</button>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${estilos.card} p-4`}>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-ink">Aprovados ({aprovados.length})</h2>
          <button type="button" onClick={() => void executar(() => carregarAssuntosIniciais(), (n) => `${n} assunto(s) carregado(s).`)} className={estilos.botaoSecundario}>Carregar lista inicial</button></div>
        {Object.keys(MATERIAS).map((m) => {
          const daMateria = aprovados.filter((a) => a.materia === m);
          return daMateria.length ? <p key={m} className="py-1 text-sm"><strong>{rotulo(m)}:</strong> <span className="text-muted">{daMateria.map((a) => a.nome).join(", ")}</span></p> : null;
        })}
      </section>
    </div>
  );
}
