"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { gerarQuestoes } from "@/actions/geracao";
import { excluirQuestao, publicarQuestao } from "@/actions/questoes";
import type { ResultadoGeracao } from "@/lib/questoes/geracao-servidor";
import { LETRAS, MATERIAS } from "@/lib/questoes/materias";
import type { Assunto } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { ConteudoQuestao, TextoAlternativa } from "./ConteudoQuestao";
import { TextoQuestao } from "./TextoQuestao";
import css from "./GeradorQuestoes.module.css";

type Base = { id: string; rotulo: string; resumo: string; materia: string; assunto_id: string | null };
type Props = {
  assuntos: Pick<Assunto, "id" | "materia" | "nome">[];
  iaOk: boolean;
  /** Quantas questões a escola ainda pode gerar hoje; null = sem limite. */
  restante: number | null;
  ehDono: boolean;
  base: Base | null;
};
type Estado = "gerada" | "publicada" | "excluida";

export function GeradorQuestoes({ assuntos, iaOk, restante, ehDono, base }: Props) {
  const [materia, setMateria] = useState(base?.materia ?? "");
  const [assuntoId, setAssuntoId] = useState(base?.assunto_id ?? "");
  const [quantidade, setQuantidade] = useState(5);
  const [dificuldade, setDificuldade] = useState<"facil" | "media" | "dificil">("media");
  const [orientacao, setOrientacao] = useState("");
  const [escopo, setEscopo] = useState<"geral" | "escola">("escola");
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoGeracao | null>(null);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [acaoEm, setAcaoEm] = useState<string | null>(null);

  const doAssunto = assuntos.filter((a) => a.materia === materia);
  const semCota = restante !== null && restante <= 0;
  const bloqueado = ocupado || !iaOk || semCota;

  function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      try {
        const r = await gerarQuestoes({ materia, assunto_id: assuntoId || null, quantidade, dificuldade, orientacao, escopo: ehDono ? escopo : "escola", base_id: base?.id ?? null });
        setResultado(r);
        setEstados({});
        // Atualiza a cota do dia (prop do servidor); o refresh mantém o estado do cliente.
        router.refresh();
      } catch (x) {
        setErro(x instanceof Error ? x.message : "Não foi possível gerar as questões.");
      }
    });
  }

  async function agir(id: string, novo: Estado) {
    setAcaoEm(id);
    setErro(null);
    try {
      if (novo === "publicada") await publicarQuestao(id, true);
      else await excluirQuestao(id);
      setEstados((s) => ({ ...s, [id]: novo }));
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível concluir a ação.");
    } finally {
      setAcaoEm(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {base && <p className={css.modelo}><strong>Modelo: {base.rotulo}</strong> — {base.resumo}</p>}
      {!iaOk && <p role="alert" className={css.aviso}>A IA não está configurada neste ambiente (falta a chave). Fale com o dono do sistema.</p>}
      <form className={css.form} onSubmit={gerar}>
        <div className={css.grade}>
          <label className={css.campo}>Matéria
            <select required disabled={!!base} value={materia} onChange={(e) => { setMateria(e.target.value); setAssuntoId(""); }} className={estilos.input}>
              <option value="">Escolha a matéria</option>
              {Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </select>
          </label>
          <label className={css.campo}>Assunto
            <select value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)} disabled={!materia} className={estilos.input}>
              <option value="">Qualquer assunto da matéria</option>
              {doAssunto.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <label className={css.campo}>Quantidade (1 a 10)
            <input type="number" min={1} max={10} required value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className={estilos.input} />
          </label>
          <label className={css.campo}>Dificuldade
            <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value as typeof dificuldade)} className={estilos.input}>
              <option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option>
            </select>
          </label>
          {ehDono && (
            <label className={css.campo}>Guardar em
              <select value={escopo} onChange={(e) => setEscopo(e.target.value as typeof escopo)} className={estilos.input}>
                <option value="escola">Questões da escola</option><option value="geral">Banco geral</option>
              </select>
            </label>
          )}
          <label className={`${css.campo} ${css.largo}`}>Orientação (opcional)
            <textarea rows={3} maxLength={500} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} className={estilos.input}
              placeholder="Ex.: contexto do Mato Grosso do Sul, sobre a Era Vargas" />
          </label>
        </div>
        {restante !== null && <p className={css.cota}>Hoje a escola ainda pode gerar {restante} {restante === 1 ? "questão" : "questões"}.</p>}
        <div>
          <button type="submit" disabled={bloqueado} className={estilos.botaoPrimario}>
            {ocupado ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Escrevendo as questões… pode levar até 2 minutos</> : <><Sparkles size={16} aria-hidden="true" /> Gerar questões</>}
          </button>
        </div>
        {erro && <p role="alert" className={css.erro}>{erro}</p>}
      </form>

      {resultado && (
        <section aria-label="Questões geradas" className="flex flex-col gap-3">
          <ul className={css.lista}>
            {resultado.questoes.map((q, i) => {
              const estado = estados[q.id] ?? "gerada";
              return (
                <li key={q.id} className={css.cartao} data-estado={estado}>
                  <div className={css.topo}>
                    <span className={css.selo}>IA · {i + 1}</span>
                    {estado === "publicada" && <span className={`${css.selo} ${css.seloOk}`}>Publicada</span>}
                    {estado === "excluida" && <span className={`${css.selo} ${css.seloRuim}`}>Na lixeira</span>}
                    {estado === "gerada" && <span className={css.selo}>Em revisão</span>}
                  </div>
                  {q.precisa_revisao && <p className={css.alerta}><TriangleAlert size={16} aria-hidden="true" />{q.motivo_revisao || "Conferir esta questão antes de publicar."}</p>}
                  <ConteudoQuestao doc={q.conteudo ?? null} textoAntigo={q.enunciado} imagens={[]} />
                  <p className={css.comando}>{q.comando}</p>
                  <ol className={css.alts}>
                    {LETRAS.map((l) => {
                      const alt = q.alternativas.find((a) => a.letra === l);
                      return <li key={l} className={css.alt} data-certa={q.resposta === l}><strong>{l})</strong> <TextoAlternativa doc={alt?.conteudo ?? null} texto={alt?.texto ?? ""} /></li>;
                    })}
                  </ol>
                  {q.resolucao && <div className={css.resolucao}><h3>Resolução</h3><TextoQuestao texto={q.resolucao} /></div>}
                  {estado !== "excluida" && (
                    <div className={css.acoes}>
                      {estado === "gerada" && <button type="button" disabled={acaoEm === q.id} onClick={() => agir(q.id, "publicada")} className={estilos.botaoPrimario}><CheckCircle2 size={16} aria-hidden="true" />Publicar</button>}
                      <Link href={`/banco/questoes/${q.id}`} className={estilos.botaoSecundario}><Pencil size={16} aria-hidden="true" />Editar</Link>
                      <button type="button" disabled={acaoEm === q.id} onClick={() => agir(q.id, "excluida")} className={estilos.botaoSecundario}><Trash2 size={16} aria-hidden="true" />Excluir</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={css.rodape}>
            {resultado.questoes.length} {resultado.questoes.length === 1 ? "questão gerada" : "questões geradas"} · custo US$ {resultado.custoUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {resultado.descartadas > 0 && ` · ${resultado.descartadas} ${resultado.descartadas === 1 ? "descartada" : "descartadas"}`}
          </p>
        </section>
      )}
    </div>
  );
}
