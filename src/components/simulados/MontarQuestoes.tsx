"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adicionarQuestao, buscarQuestoesBanco, removerQuestao, sortearQuestoes, trocarQuestao } from "@/actions/simulados";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";

type Item = { id: string; banca: string; ano: number | null; numero: number | null; materia: string; trecho: string };
type Props = { simuladoId: string; questoes: Item[]; travado: boolean; assuntos: { id: string; materia: string; nome: string }[] };
const rotuloMateria = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;

export function MontarQuestoes({ simuladoId, questoes, travado, assuntos }: Props) {
  const router = useRouter();
  const [area, setArea] = useState(""); const [materia, setMateria] = useState(""); const [assunto, setAssunto] = useState("");
  const [banca, setBanca] = useState(""); const [anoDe, setAnoDe] = useState(""); const [anoAte, setAnoAte] = useState("");
  const [quantidade, setQuantidade] = useState("10");
  const [texto, setTexto] = useState(""); const [achadas, setAchadas] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState<string | null>(null);
  const filtros = () => ({ area: (area || undefined) as Area | undefined, materia: materia || undefined, assunto_id: assunto || undefined, banca: banca.trim() || undefined, anoDe: anoDe ? Number(anoDe) : undefined, anoAte: anoAte ? Number(anoAte) : undefined });

  async function executar(acao: () => Promise<void>) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); router.refresh(); } catch (e) { setErro(e instanceof Error ? e.message : "Algo deu errado."); } finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">{aviso}</p>}
      {travado ? <p className="text-sm text-muted">Alunos já começaram — as questões estão travadas.</p> : (
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={estilos.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={materia} onChange={(e) => { setMateria(e.target.value); setAssunto(""); }} aria-label="Matéria" className={estilos.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
          <select value={assunto} onChange={(e) => setAssunto(e.target.value)} aria-label="Assunto" disabled={!materia} className={estilos.input}><option value="">Assunto</option>{assuntos.filter((a) => a.materia === materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>
          <input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Banca" aria-label="Banca" className={estilos.input} />
          <input value={anoDe} onChange={(e) => setAnoDe(e.target.value.replace(/\D/g, ""))} placeholder="Ano de" aria-label="Ano de" inputMode="numeric" className={estilos.input} />
          <input value={anoAte} onChange={(e) => setAnoAte(e.target.value.replace(/\D/g, ""))} placeholder="Ano até" aria-label="Ano até" inputMode="numeric" className={estilos.input} />
          <div className="flex gap-2">
            <input value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} aria-label="Quantidade" inputMode="numeric" className={`${estilos.input} w-16`} />
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { const r = await sortearQuestoes(simuladoId, { ...filtros(), quantidade: Number(quantidade) }); if (r.adicionadas < r.pedidas) setAviso(`Foram adicionadas ${r.adicionadas} de ${r.pedidas} (não há mais questões com esses filtros).`); })} className={estilos.botaoPrimario}>Sortear</button>
          </div>
        </div>
      )}
      <ol className="divide-y divide-line">
        {questoes.map((q, i) => (
          <li key={q.id} className="flex flex-wrap items-start gap-2 py-2 text-sm">
            <span className="w-6 font-mono text-muted">{i + 1}.</span>
            <span className="min-w-0 flex-1"><span className="block text-xs text-muted">{q.banca} {q.ano ?? ""} · Nº {q.numero ?? "—"} · {rotuloMateria(q.materia)}</span><span className="line-clamp-2 text-ink">{q.trecho}</span></span>
            <Link href={`/banco/questoes/${q.id}`} target="_blank" className={estilos.botaoFantasma}>Ver</Link>
            {!travado && <>
              <button type="button" disabled={ocupado} onClick={() => void executar(async () => { if (!(await trocarQuestao(simuladoId, q.id, filtros()))) setAviso("Não há outra questão com os filtros atuais."); })} className={estilos.botaoFantasma}>Trocar</button>
              <button type="button" disabled={ocupado} onClick={() => void executar(() => removerQuestao(simuladoId, q.id))} className={estilos.botaoFantasma}>Remover</button>
            </>}
          </li>
        ))}
        {questoes.length === 0 && <li className="py-4 text-sm text-muted">Nenhuma questão ainda. Use os filtros e &quot;Sortear&quot;.</li>}
      </ol>
      {!travado && (
        <details className="rounded-control border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">+ Adicionar do banco</summary>
          <div className="mt-2 flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar no enunciado" aria-label="Buscar no banco" className={estilos.input} />
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => setAchadas(await buscarQuestoesBanco(simuladoId, texto, filtros())))} className={estilos.botaoSecundario}>Buscar</button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {achadas.map((q) => (
              <li key={q.id} className="flex items-start gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="block text-xs text-muted">{q.banca} {q.ano ?? ""} · {rotuloMateria(q.materia)}</span><span className="line-clamp-2">{q.trecho}</span></span>
                <button type="button" disabled={ocupado || questoes.some((x) => x.id === q.id)} onClick={() => void executar(() => adicionarQuestao(simuladoId, q.id))} className={estilos.botaoFantasma}>{questoes.some((x) => x.id === q.id) ? "Já está" : "Adicionar"}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
