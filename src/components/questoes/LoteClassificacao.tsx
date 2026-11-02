"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Tags } from "lucide-react";
import { classificarQuestoes } from "@/actions/classificacao";
import { LIMITE_LOTE, mesmaArea, mesmoAssunto, type ItemLote, type QuestaoLote, type Recusa } from "@/lib/questoes/classificacao";
import type { Habilidade, Topico } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { CamposClassificacao, type ValorClassificacao } from "./CamposClassificacao";
import lista from "@/app/banco/Banco.module.css";
import styles from "./LoteClassificacao.module.css";

/** Questão da página: dados para o lote e o cartão já montado no servidor. */
export type ItemLista = { questao: QuestaoLote; podeEditar: boolean; cartao: ReactNode };

type Props = {
  itens: ItemLista[];
  /** null quando as tabelas de classificação ainda não existem: a lista aparece sem seleção. */
  dados: { topicos: Topico[]; habilidades: Habilidade[] } | null;
};

/** Texto do resultado, juntando os motivos iguais: "38 classificadas, 2 sem permissão". */
export function resumoResultado(salvas: number, recusados: Recusa[]): string {
  const motivos = new Map<string, number>();
  for (const r of recusados) motivos.set(r.motivo, (motivos.get(r.motivo) ?? 0) + 1);
  const partes = [`${salvas} ${salvas === 1 ? "classificada" : "classificadas"}`];
  for (const [motivo, n] of motivos) {
    partes.push(motivo.startsWith("Sem permissão") ? `${n} sem permissão` : `${n} recusada${n === 1 ? "" : "s"} (${motivo.replace(/\.$/, "").toLowerCase()})`);
  }
  return partes.join(", ");
}

/** Lista de questões do banco com seleção para classificar em lote (só as que a pessoa pode editar). */
export function LoteClassificacao({ itens, dados }: Props) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState<ValorClassificacao>({ topicoId: null, habilidadeIds: [] });
  const [modo, setModo] = useState<"adicionar" | "trocar">("adicionar");
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const editaveis = useMemo(() => itens.filter((i) => i.podeEditar), [itens]);
  const escolhidas = useMemo(() => editaveis.filter((i) => marcadas.has(i.questao.id)).map((i) => i.questao), [editaveis, marcadas]);
  const assunto = mesmoAssunto(escolhidas);
  const area = mesmaArea(escolhidas);
  const selecionavel = !!dados;

  function alternar(id: string) {
    setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setResultado(null);
  }
  function alternarTodas() {
    setResultado(null);
    setMarcadas(marcadas.size === editaveis.length ? new Set() : new Set(editaveis.map((i) => i.questao.id)));
  }

  async function aplicar() {
    const temTopico = !!assunto && !!valor.topicoId;
    const temHab = !!area && valor.habilidadeIds.length > 0;
    if (!temTopico && !temHab) { setErro("Escolha um tópico ou ao menos uma habilidade."); return; }
    setSalvando(true); setErro(null); setResultado(null);
    const ids = escolhidas.map((q) => q.id);
    let salvas = 0;
    const recusados: Recusa[] = [];
    try {
      for (let i = 0; i < ids.length; i += LIMITE_LOTE) {
        const itensLote: ItemLote[] = ids.slice(i, i + LIMITE_LOTE).map((questaoId) => ({
          questaoId,
          ...(temTopico && { topicoId: valor.topicoId }),
          ...(temHab && { habilidadeIds: valor.habilidadeIds }),
        }));
        const r = await classificarQuestoes(itensLote, modo);
        salvas += r.salvas;
        recusados.push(...r.recusados);
      }
      setResultado(resumoResultado(salvas, recusados));
      setMarcadas(new Set());
      setAberto(false);
      setValor({ topicoId: null, habilidadeIds: [] });
    } catch (e) {
      const parcial = salvas > 0 || recusados.length > 0 ? ` (até aqui: ${resumoResultado(salvas, recusados)})` : "";
      setErro((e instanceof Error ? e.message : "Não foi possível classificar.") + parcial);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {selecionavel && editaveis.length > 0 && (
        <label className={styles.todas}>
          <input type="checkbox" checked={marcadas.size === editaveis.length} onChange={alternarTodas} />
          Selecionar todas desta página
        </label>
      )}
      {resultado && <p role="status" className={styles.resultado}>{resultado}</p>}
      <ul className={lista.lista}>
        {itens.map((item, i) => (
          <li key={item.questao.id} className={styles.item} style={{ "--i": Math.min(i, 12) } as CSSProperties}>
            {item.cartao}
            {selecionavel && item.podeEditar && (
              <label className={styles.marcar} title="Selecionar para classificar">
                <input type="checkbox" checked={marcadas.has(item.questao.id)} onChange={() => alternar(item.questao.id)} aria-label={`Selecionar a questão ${i + 1} para classificar`} />
              </label>
            )}
          </li>
        ))}
      </ul>

      {selecionavel && escolhidas.length > 0 && !aberto && (
        <div className={styles.barra} role="region" aria-label="Classificar selecionadas">
          <span>{escolhidas.length} {escolhidas.length === 1 ? "selecionada" : "selecionadas"}</span>
          <button type="button" onClick={() => { setAberto(true); setErro(null); }} className={estilos.botaoSecundario}><Tags size={16} aria-hidden="true" /> Classificar</button>
          <button type="button" onClick={() => setMarcadas(new Set())} className={styles.limpar}>Limpar</button>
        </div>
      )}

      {selecionavel && aberto && dados && escolhidas.length > 0 && (
        <div className={styles.fundo} onClick={(e) => { if (e.target === e.currentTarget && !salvando) setAberto(false); }}>
          <div className={styles.painel} role="dialog" aria-modal="true" aria-label="Classificar questões selecionadas">
            <h2>Classificar {escolhidas.length} {escolhidas.length === 1 ? "questão" : "questões"}</h2>
            <CamposClassificacao assuntoId={assunto} area={area ?? escolhidas[0].area} topicos={dados.topicos} habilidades={dados.habilidades}
              topicoId={valor.topicoId} habilidadeIds={valor.habilidadeIds} onChange={setValor} desabilitado={salvando}
              motivoSemTopico={assunto ? undefined : "Tópico só quando todas as selecionadas são do mesmo assunto."}
              motivoSemHabilidades={area ? undefined : "Habilidades só quando todas as selecionadas são da mesma área."} />
            {area && (
              <div className={styles.modos} role="radiogroup" aria-label="Como gravar as habilidades">
                <span>Habilidades:</span>
                <label><input type="radio" name="modo" checked={modo === "adicionar"} onChange={() => setModo("adicionar")} disabled={salvando} /> adicionar às que já têm</label>
                <label><input type="radio" name="modo" checked={modo === "trocar"} onChange={() => setModo("trocar")} disabled={salvando} /> trocar pelas escolhidas</label>
              </div>
            )}
            {erro && <p role="alert" className={styles.erro}>{erro}</p>}
            <div className={styles.botoes}>
              <button type="button" onClick={() => void aplicar()} disabled={salvando} className={estilos.botaoPrimario}>{salvando ? "Classificando…" : `Classificar ${escolhidas.length}`}</button>
              <button type="button" onClick={() => setAberto(false)} disabled={salvando} className={estilos.botaoSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
