"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarSimulado, salvarSimulado, type DadosSimulado } from "@/actions/simulados";
import { estilos } from "@/components/ui/estilos";

type Props = { inicial?: DadosSimulado & { id: string }; turmas: { turma_nome: string; ano_letivo: string }[] };
const chave = (t: { turma_nome: string; ano_letivo: string }) => `${t.turma_nome}|${t.ano_letivo}`;

function paraInputData(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FormSimulado({ inicial, turmas }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [marcadas, setMarcadas] = useState(new Set((inicial?.turmas ?? []).map(chave)));
  const [duracao, setDuracao] = useState(String(inicial?.duracaoMin ?? 90));
  const [abre, setAbre] = useState(paraInputData(inicial?.abreEm));
  const [fecha, setFecha] = useState(paraInputData(inicial?.fechaEm));
  const [correcao, setCorrecao] = useState<DadosSimulado["correcao"]>(inicial?.correcao ?? "apos_prazo");
  const [embaralhar, setEmbaralhar] = useState(inicial?.embaralhar ?? true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null); setAviso(null);
    const dados: DadosSimulado = {
      titulo, turmas: turmas.filter((t) => marcadas.has(chave(t))), duracaoMin: Number(duracao),
      abreEm: abre ? new Date(abre).toISOString() : "", fechaEm: fecha ? new Date(fecha).toISOString() : "", correcao, embaralhar,
    };
    try {
      if (inicial) { await salvarSimulado(inicial.id, dados); setAviso("Salvo."); router.refresh(); }
      else router.push(`/simulados/${await criarSimulado(dados)}/editar`);
    } catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Simulado ENEM — Natureza" className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Turmas</legend>
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => { const k = chave(t); return (
            <label key={k} className="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-sm text-ink">
              <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => { const n = new Set(marcadas); if (e.target.checked) n.add(k); else n.delete(k); setMarcadas(n); }} /> {t.turma_nome} · {t.ano_letivo}
            </label>); })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Duração (min)<input value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Abre em<input type="datetime-local" value={abre} onChange={(e) => setAbre(e.target.value)} required className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Fecha em<input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={estilos.input} /></label>
      </div>
      <fieldset className="flex flex-col gap-1 text-sm text-ink">
        <legend className="mb-1 text-xs text-muted">Quando o aluno vê a correção</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={correcao === "apos_prazo"} onChange={() => setCorrecao("apos_prazo")} /> Depois que o prazo terminar</label>
        <label className="flex items-center gap-2"><input type="radio" checked={correcao === "na_hora"} onChange={() => setCorrecao("na_hora")} /> Logo que entregar</label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={embaralhar} onChange={(e) => setEmbaralhar(e.target.checked)} /> Embaralhar a ordem das questões para cada aluno</label>
      <button type="submit" disabled={ocupado} className={estilos.botaoPrimario}>{ocupado ? "Salvando…" : inicial ? "Salvar dados" : "Criar e escolher questões"}</button>
    </form>
  );
}
