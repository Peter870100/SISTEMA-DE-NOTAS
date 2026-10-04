"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarTreino, iniciarTentativa } from "@/actions/simulados-aluno";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";

const rotulo = "mb-1 block text-xs font-semibold text-muted";

export function NovoTreino() {
  const router = useRouter();
  const [area, setArea] = useState("");
  const [materia, setMateria] = useState("");
  const [banca, setBanca] = useState("");
  const [anoDe, setAnoDe] = useState("");
  const [anoAte, setAnoAte] = useState("");
  const [quantidade, setQuantidade] = useState("10");
  const [tempo, setTempo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const materias = Object.entries(MATERIAS).filter(([, m]) => !area || m.area === area);
  const numero = (v: string) => (v.trim() === "" ? undefined : Number(v));

  async function comecar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null); setAviso(null);
    try {
      const minutos = numero(tempo);
      const r = await criarTreino({
        area: (area || undefined) as Area | undefined,
        materia: materia || undefined,
        banca: banca.trim() || undefined,
        anoDe: numero(anoDe),
        anoAte: numero(anoAte),
        quantidade: Number(quantidade),
        duracaoMin: minutos === undefined ? null : minutos,
      });
      await iniciarTentativa(r.simuladoId);
      if (r.sorteadas < r.pedidas) {
        setAviso(`Só havia ${r.sorteadas} questões com esses filtros. Seu treino vai ter ${r.sorteadas}.`);
        await new Promise((ok) => setTimeout(ok, 2500));
      }
      router.push(`/aluno/simulados/${r.simuladoId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o treino.");
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={(e) => void comecar(e)} className={`${estilos.card} flex flex-col gap-3 p-4`}>
      <h3 className="font-semibold text-ink">Novo treino</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="t-area" className={rotulo}>Área</label>
          <select id="t-area" value={area} onChange={(e) => { setArea(e.target.value); setMateria(""); }} className={estilos.input}>
            <option value="">Todas</option>
            {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-materia" className={rotulo}>Matéria</label>
          <select id="t-materia" value={materia} onChange={(e) => setMateria(e.target.value)} className={estilos.input}>
            <option value="">Todas</option>
            {materias.map(([k, m]) => <option key={k} value={k}>{m.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-banca" className={rotulo}>Banca</label>
          <input id="t-banca" value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="ENEM, FUVEST…" className={estilos.input} />
        </div>
        <div>
          <label htmlFor="t-de" className={rotulo}>Ano de</label>
          <input id="t-de" type="number" inputMode="numeric" value={anoDe} onChange={(e) => setAnoDe(e.target.value)} className={estilos.input} />
        </div>
        <div>
          <label htmlFor="t-ate" className={rotulo}>Ano até</label>
          <input id="t-ate" type="number" inputMode="numeric" value={anoAte} onChange={(e) => setAnoAte(e.target.value)} className={estilos.input} />
        </div>
        <div>
          <label htmlFor="t-qtd" className={rotulo}>Quantidade (1 a 90)</label>
          <input id="t-qtd" type="number" min={1} max={90} required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={estilos.input} />
        </div>
        <div>
          <label htmlFor="t-tempo" className={rotulo}>Tempo (minutos)</label>
          <input id="t-tempo" type="number" min={1} max={600} value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="Sem tempo" className={estilos.input} />
        </div>
      </div>
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <button type="submit" disabled={ocupado} className={`${estilos.botaoPrimario} w-fit`}>{ocupado ? "Montando…" : "Começar treino"}</button>
    </form>
  );
}
