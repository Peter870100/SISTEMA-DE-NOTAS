"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarSimulado, salvarSimulado, type DadosSimulado } from "@/actions/simulados";
import { Clock3, CalendarDays, CheckCircle2, Save, Shuffle, Users } from "lucide-react";
import base from "@/components/admin/ContasAdmin.module.css";
import css from "./EditorSimulado.module.css";

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
      if (inicial) {
        const r = await salvarSimulado(inicial.id, dados);
        if (!r.ok) throw new Error(r.erro);
        setAviso("Salvo."); router.refresh();
      } else {
        const r = await criarSimulado(dados);
        if (!r.ok) throw new Error(r.erro);
        router.push(`/simulados/${r.valor}/editar`);
      }
    } catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  return (
    <form onSubmit={salvar} className={css.form}>
      {erro && <p role="alert" className={base.error}>{erro}</p>}
      {aviso && <p role="status" className={css.notice}><CheckCircle2 size={18} aria-hidden="true" />Dados salvos com sucesso.</p>}
      <label className={css.field}>Título do simulado<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex.: Simulado ENEM — Natureza" /></label>
      <fieldset className={css.fieldset}>
        <legend><Users size={18} aria-hidden="true" />Turmas participantes</legend>
        <p className={css.hint}>Selecione as turmas que poderão acessar este simulado.</p>
        <div className={css.chips}>
          {turmas.map((t) => { const k = chave(t); return (
            <label key={k} className={css.chip} data-selected={marcadas.has(k)}>
              <input type="checkbox" checked={marcadas.has(k)} onChange={(e) => { const n = new Set(marcadas); if (e.target.checked) n.add(k); else n.delete(k); setMarcadas(n); }} />{t.turma_nome} · {t.ano_letivo}
            </label>); })}
          {turmas.length === 0 && <p className={css.hint}>Nenhuma turma disponível.</p>}
        </div>
      </fieldset>
      <div className={css.schedule}>
        <label className={css.field}><span><Clock3 size={17} aria-hidden="true" />Duração (minutos)</span><input value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} inputMode="numeric" required /></label>
        <label className={css.field}><span><CalendarDays size={17} aria-hidden="true" />Abre em</span><input type="datetime-local" value={abre} onChange={(e) => setAbre(e.target.value)} required /></label>
        <label className={css.field}><span><CalendarDays size={17} aria-hidden="true" />Fecha em</span><input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></label>
      </div>
      <fieldset className={css.fieldset}>
        <legend><CheckCircle2 size={18} aria-hidden="true" />Quando liberar a correção</legend>
        <div className={css.correction}>
          <label className={css.choice} data-selected={correcao === "apos_prazo"}><input type="radio" name="correcao" checked={correcao === "apos_prazo"} onChange={() => setCorrecao("apos_prazo")} /><span><strong>Depois do prazo</strong><small>O aluno vê a correção quando o simulado encerrar.</small></span></label>
          <label className={css.choice} data-selected={correcao === "na_hora"}><input type="radio" name="correcao" checked={correcao === "na_hora"} onChange={() => setCorrecao("na_hora")} /><span><strong>Logo que entregar</strong><small>A correção fica disponível após a entrega.</small></span></label>
        </div>
      </fieldset>
      <label className={css.shuffle}><input type="checkbox" checked={embaralhar} onChange={(e) => setEmbaralhar(e.target.checked)} /><Shuffle size={18} aria-hidden="true" /><span>Embaralhar a ordem das questões para cada aluno</span></label>
      <div className={css.formFooter}><button type="submit" disabled={ocupado} className={base.primary}><Save size={18} aria-hidden="true" />{ocupado ? "Salvando..." : inicial ? "Salvar dados" : "Criar e escolher questões"}</button></div>
    </form>
  );
}
