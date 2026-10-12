"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adicionarQuestao, buscarQuestoesBanco, removerQuestao, sortearQuestoes, trocarQuestao } from "@/actions/simulados";
import { AREAS, MATERIAS } from "@/lib/questoes/materias";
import type { Area } from "@/lib/types";
import { Dices, Search, Plus, BookOpen, Eye, RefreshCw, Trash2 } from "lucide-react";
import base from "@/components/admin/ContasAdmin.module.css";
import css from "./EditorSimulado.module.css";

type Item = { id: string; banca: string; ano: number | null; numero: number | null; materia: string; trecho: string };
type Props = { simuladoId: string; questoes: Item[]; travado: boolean; assuntos: { id: string; materia: string; nome: string }[] };
const rotuloMateria = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;

/** As actions devolvem { ok, erro } (em produção o Next esconde mensagens de erros lançados). */
function desembrulhar<T>(r: { ok: true; valor: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro);
  return r.valor;
}

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
    <div className={css.form}>
      {erro && <p role="alert" className={base.error}>{erro}</p>}
      {aviso && <p role="status" className={base.notice}>{aviso}</p>}
      {travado ? <p className={css.hint}>Alunos já começaram — as questões estão travadas.</p> : (
        <div className={css.filters}>
          <label className={css.field}>Área<select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={css.input}><option value="">Área</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className={css.field}>Matéria<select value={materia} onChange={(e) => { setMateria(e.target.value); setAssunto(""); }} aria-label="Matéria" className={css.input}><option value="">Matéria</option>{Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select></label>
          <label className={css.field}>Assunto<select value={assunto} onChange={(e) => setAssunto(e.target.value)} aria-label="Assunto" disabled={!materia} className={css.input}><option value="">Assunto</option>{assuntos.filter((a) => a.materia === materia).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
          <label className={css.field}>Banca<input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="Banca" aria-label="Banca" className={css.input} /></label>
          <label className={css.field}>Ano de<input value={anoDe} onChange={(e) => setAnoDe(e.target.value.replace(/\D/g, ""))} placeholder="Ano de" aria-label="Ano de" inputMode="numeric" className={css.input} /></label>
          <label className={css.field}>Ano até<input value={anoAte} onChange={(e) => setAnoAte(e.target.value.replace(/\D/g, ""))} placeholder="Ano até" aria-label="Ano até" inputMode="numeric" className={css.input} /></label>
          <div className={css.draw}>
            <label className={css.field}>Quantidade<input value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} aria-label="Quantidade" inputMode="numeric" className={css.input} /></label>
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { const r = desembrulhar(await sortearQuestoes(simuladoId, { ...filtros(), quantidade: Number(quantidade) })); if (r.adicionadas < r.pedidas) setAviso(`Foram adicionadas ${r.adicionadas} de ${r.pedidas} (não há mais questões com esses filtros).`); })} className={base.primary}><Dices size={18} aria-hidden="true" />Sortear questões</button>
          </div>
        </div>
      )}
      <ol className={css.questionList}>
        {questoes.map((q, i) => (
          <li key={q.id} className={css.question}>
            <span className={css.questionNumber}>{i + 1}.</span>
            <span className={css.questionText}><span className={css.meta}>{q.banca} {q.ano ?? ""} · Nº {q.numero ?? "—"} · {rotuloMateria(q.materia)}</span><span className={css.excerpt}>{q.trecho}</span></span>
            <Link href={`/banco/questoes/${q.id}`} target="_blank" className={base.secondary}><Eye size={16} aria-hidden="true" />Ver</Link>
            {!travado && <>
              <button type="button" disabled={ocupado} onClick={() => void executar(async () => { if (!desembrulhar(await trocarQuestao(simuladoId, q.id, filtros()))) setAviso("Não há outra questão com os filtros atuais."); })} className={base.secondary}><RefreshCw size={16} aria-hidden="true" />Trocar</button>
              <button type="button" disabled={ocupado} onClick={() => void executar(async () => { desembrulhar(await removerQuestao(simuladoId, q.id)); })} className={css.remove}><Trash2 size={16} aria-hidden="true" />Remover</button>
            </>}
          </li>
        ))}
        {questoes.length === 0 && <li className={css.empty}><BookOpen size={28} aria-hidden="true" /><strong>Monte seu simulado</strong><span>Use os filtros para sortear questões ou escolha no banco abaixo.</span></li>}
      </ol>
      {!travado && (
        <details className={css.bank}>
          <summary className={css.bankSummary}><Plus size={18} aria-hidden="true" />Adicionar do banco</summary>
          <div className={css.search}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar no enunciado" aria-label="Buscar no banco" className={css.input} />
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => setAchadas(desembrulhar(await buscarQuestoesBanco(simuladoId, texto, filtros()))))} className={base.secondary}><Search size={17} aria-hidden="true" />Buscar</button>
          </div>
          <ul className={css.questionList}>
            {achadas.map((q) => (
              <li key={q.id} className={css.question}>
                <span className={css.questionText}><span className={css.meta}>{q.banca} {q.ano ?? ""} · {rotuloMateria(q.materia)}</span><span className={css.excerpt}>{q.trecho}</span></span>
                <button type="button" disabled={ocupado || questoes.some((x) => x.id === q.id)} onClick={() => void executar(async () => { desembrulhar(await adicionarQuestao(simuladoId, q.id)); })} className={base.secondary}>{questoes.some((x) => x.id === q.id) ? "Já está" : "Adicionar"}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
