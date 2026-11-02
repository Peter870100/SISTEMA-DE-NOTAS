"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, FileText, Loader2, Search } from "lucide-react";
import { MATERIAS } from "@/lib/questoes/materias";
// Só tipos: o módulo usa node:crypto e não pode ir para o navegador.
import type { Cenario, TipoProva } from "@/lib/folha/provas-word";
import { estilos } from "@/components/ui/estilos";
import { gerarProvaWord, previaProvaWord } from "./acoes";
import { MenuBaixar } from "./MenuBaixar";
import css from "./ProvasWord.module.css";

type Pedido = { banca: string; materia: string; assunto: string; anoDe: number | null; anoAte: number | null; quantidade: number };
type Previa = { texto: string; cenario: Cenario; pedido: Pedido };
type Gerada = { id: string; titulo: string; total: number; repetidas: number; pedidas: number };

const ano = (v: string) => (v.trim() ? Number(v) : null);

/** Formulário "Nova prova": prévia das inéditas (mesmas frases da Hermes) e só então gerar. */
export function NovaProva({ limite }: { limite: number }) {
  const [banca, setBanca] = useState("");
  const [materia, setMateria] = useState("");
  const [assunto, setAssunto] = useState("");
  const [anoDe, setAnoDe] = useState("");
  const [anoAte, setAnoAte] = useState("");
  const [quantidade, setQuantidade] = useState("10");
  const [tipo, setTipo] = useState<TipoProva>("fixacao");
  const [valor, setValor] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [completar, setCompletar] = useState(false);
  const [gerada, setGerada] = useState<Gerada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  /** Mudou um filtro: a prévia anterior não vale mais. */
  const mudar = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    setPrevia(null);
    setErro(null);
  };

  function verPrevia(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setGerada(null);
    const pedido: Pedido = { banca: banca.trim(), materia, assunto: assunto.trim(), anoDe: ano(anoDe), anoAte: ano(anoAte), quantidade: Number(quantidade) };
    iniciar(async () => {
      const r = await previaProvaWord({ ...pedido, banca: pedido.banca || undefined, assunto: pedido.assunto || undefined });
      if (!r.ok) {
        setPrevia(null);
        setErro(r.erro);
        return;
      }
      setPrevia({ texto: r.texto, cenario: r.cenario, pedido });
      // Sem nenhuma inédita, a única prova possível é com as já usadas.
      setCompletar(r.cenario.ineditas === 0);
    });
  }

  function gerar() {
    if (!previa) return;
    setErro(null);
    const { pedido, cenario } = previa;
    iniciar(async () => {
      const r = await gerarProvaWord({
        pedido: { ...pedido, banca: pedido.banca || undefined, assunto: pedido.assunto || undefined },
        tipo,
        permitirRepetidas: !cenario.cabeEmIneditas && completar,
        valor,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setGerada(r);
      setPrevia(null);
    });
  }

  const c = previa?.cenario;
  const tamanhoCompleto = c ? Math.min(c.pedidas, c.elegiveis) : 0;

  return (
    <form className={css.form} onSubmit={verPrevia}>
      <h2 className={css.titulo}><span className={css.icone} aria-hidden="true"><FileText size={20} /></span>Nova prova</h2>
      <div className={css.grade}>
        <label className={css.campo}>Banca
          <input value={banca} onChange={mudar(setBanca)} placeholder="Ex.: UFMS, ENEM" maxLength={60} className={estilos.input} />
        </label>
        <label className={css.campo}>Matéria
          <select value={materia} onChange={mudar(setMateria)} required className={estilos.input}>
            <option value="">Escolha</option>
            {Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </label>
        <label className={css.campo}>Assunto (opcional)
          <input value={assunto} onChange={mudar(setAssunto)} placeholder="Ex.: Genética" maxLength={120} className={estilos.input} />
        </label>
        <label className={css.campo}>Ano de
          <input value={anoDe} onChange={mudar(setAnoDe)} type="number" min={1900} max={2100} placeholder="Qualquer" className={estilos.input} />
        </label>
        <label className={css.campo}>Ano até
          <input value={anoAte} onChange={mudar(setAnoAte)} type="number" min={1900} max={2100} placeholder="Qualquer" className={estilos.input} />
        </label>
        <label className={css.campo}>Quantidade
          <input value={quantidade} onChange={mudar(setQuantidade)} type="number" min={1} max={limite} required className={estilos.input} />
        </label>
        <label className={css.campo}>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoProva)} className={estilos.input}>
            <option value="fixacao">Atividade de Fixação</option>
            <option value="simulado">Simulado</option>
          </select>
        </label>
        <label className={css.campo}>Valor da prova
          <input value={valor} onChange={(e) => { setValor(e.target.value); setErro(null); }} inputMode="decimal" maxLength={15} placeholder="Sem valor" className={estilos.input} />
        </label>
      </div>
      <div className={css.botoes}>
        <button type="submit" disabled={ocupado} className={estilos.botaoSecundario}>
          {ocupado && !previa ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          Ver questões disponíveis
        </button>
      </div>

      {erro && <p role="alert" className={css.erro}>{erro}</p>}

      {previa && c && (
        <div className={css.previa} aria-live="polite">
          <p>{previa.texto}</p>
          {c.elegiveis > 0 && !c.cabeEmIneditas && (
            c.ineditas > 0 ? (
              <fieldset className={css.opcoes}>
                <legend className="sr-only">Faltam inéditas</legend>
                <label><input type="radio" name="completar" checked={!completar} onChange={() => setCompletar(false)} />Fazer a prova só com as {c.ineditas} {c.ineditas === 1 ? "inédita" : "inéditas"}</label>
                <label><input type="radio" name="completar" checked={completar} onChange={() => setCompletar(true)} />Completar com já usadas (prova com {tamanhoCompleto} {tamanhoCompleto === 1 ? "questão" : "questões"})</label>
              </fieldset>
            ) : (
              <p className={css.opcoes}>Não há inéditas: a prova sai com {tamanhoCompleto} {tamanhoCompleto === 1 ? "questão já usada" : "questões já usadas"}.</p>
            )
          )}
          {c.elegiveis > 0 && (
            <div className={css.botoes}>
              <button type="button" onClick={gerar} disabled={ocupado} className={estilos.botaoPrimario}>
                {ocupado ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                Gerar prova
              </button>
            </div>
          )}
        </div>
      )}

      {gerada && (
        <div className={css.ok} role="status">
          <p><CheckCircle2 size={18} className="mr-1 inline" aria-hidden="true" />
            Prova &quot;{gerada.titulo}&quot; com {gerada.total} {gerada.total === 1 ? "questão" : "questões"}
            {gerada.repetidas > 0 && ` (${gerada.repetidas} já ${gerada.repetidas === 1 ? "usada" : "usadas"} antes)`}
            {gerada.total < gerada.pedidas && ` — pedidas ${gerada.pedidas}; não havia mais`}.
          </p>
          <div className={css.botoes}>
            <Link href={`/banco/provas-word/${gerada.id}/previa`} className={estilos.botaoPrimario}><Eye size={16} aria-hidden="true" />Pré-visualizar</Link>
            <MenuBaixar provaId={gerada.id} classeBotao={estilos.botaoSecundario} />
          </div>
        </div>
      )}
    </form>
  );
}
