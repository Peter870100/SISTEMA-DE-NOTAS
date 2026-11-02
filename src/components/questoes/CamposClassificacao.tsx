"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { proporTopico } from "@/actions/classificacao";
import { nomeNormalizado } from "@/lib/questoes/classificacao";
import type { Area, Habilidade, Topico } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import styles from "./CamposClassificacao.module.css";

export type ValorClassificacao = { topicoId: string | null; habilidadeIds: string[] };

type Props = {
  /** Assunto da questão: os tópicos oferecidos são os dele. Sem assunto, o campo avisa e fica desligado. */
  assuntoId: string | null;
  /** Área da questão: só as habilidades dela são oferecidas. */
  area: Area;
  topicos: Topico[];
  habilidades: Habilidade[];
  topicoId: string | null;
  habilidadeIds: string[];
  onChange: (v: ValorClassificacao) => void;
  /** Professor ou admin podem propor tópico; false esconde o botão. */
  podeProporTopico?: boolean;
  desabilitado?: boolean;
  /** Quando informado, o campo de tópico fica desligado e mostra este motivo (ex.: lote com assuntos diferentes). */
  motivoSemTopico?: string;
  /** Idem para as habilidades (ex.: lote com áreas diferentes). */
  motivoSemHabilidades?: string;
};

/** Tópico (com "+ propor tópico") e Habilidades da área, com busca. Compartilhado pelo editor e pela tela de classificar. */
export function CamposClassificacao({
  assuntoId, area, topicos, habilidades, topicoId, habilidadeIds, onChange, podeProporTopico = true, desabilitado = false, motivoSemTopico, motivoSemHabilidades,
}: Props) {
  const [propostos, setPropostos] = useState<Topico[]>([]);
  const [propondo, setPropondo] = useState(false);
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const doAssunto = useMemo(() => {
    if (!assuntoId) return [];
    const todos = [...topicos, ...propostos.filter((p) => !topicos.some((t) => t.id === p.id))];
    return todos.filter((t) => t.assunto_id === assuntoId).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [assuntoId, topicos, propostos]);

  const daArea = useMemo(() => habilidades.filter((h) => h.area === area), [habilidades, area]);
  const visiveis = useMemo(() => {
    const q = nomeNormalizado(busca);
    // Marcadas continuam à mostra mesmo fora da busca, para não sumirem sem aviso.
    return daArea.filter((h) => !q || habilidadeIds.includes(h.id) || nomeNormalizado(`${h.codigo ?? ""} ${h.descricao}`).includes(q));
  }, [daArea, busca, habilidadeIds]);

  function alternar(id: string) {
    const marcadas = habilidadeIds.includes(id) ? habilidadeIds.filter((x) => x !== id) : [...habilidadeIds, id];
    onChange({ topicoId, habilidadeIds: marcadas });
  }

  async function propor() {
    if (!assuntoId || !nome.trim()) return;
    setOcupado(true); setErro(null);
    try {
      const t = await proporTopico(assuntoId, nome);
      setPropostos((x) => [...x.filter((p) => p.id !== t.id), t]);
      onChange({ topicoId: t.id, habilidadeIds });
      setNome(""); setPropondo(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível propor o tópico.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={styles.campos}>
      <div className={styles.campo}>
        <label className="flex flex-col gap-1 text-xs text-muted">Tópico
          <select value={topicoId ?? ""} disabled={desabilitado || !assuntoId || !!motivoSemTopico} onChange={(e) => onChange({ topicoId: e.target.value || null, habilidadeIds })} className={estilos.input}>
            <option value="">— sem tópico —</option>
            {doAssunto.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.situacao === "proposto" ? " (proposto)" : ""}</option>)}
          </select>
        </label>
        {motivoSemTopico && <p className={styles.dica}>{motivoSemTopico}</p>}
        {!assuntoId && !motivoSemTopico && <p className={styles.dica}>Escolha um assunto para ver os tópicos.</p>}
        {assuntoId && !motivoSemTopico && podeProporTopico && !propondo && (
          <button type="button" disabled={desabilitado} onClick={() => setPropondo(true)} className={styles.link}><Plus size={14} aria-hidden="true" /> propor tópico</button>
        )}
        {assuntoId && propondo && (
          <div className={styles.propor}>
            <input value={nome} maxLength={120} placeholder="Nome do novo tópico" aria-label="Nome do novo tópico" disabled={ocupado}
              onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void propor(); } }} className={estilos.input} />
            <button type="button" disabled={ocupado || !nome.trim()} onClick={() => void propor()} className={styles.botao}>{ocupado ? "Enviando…" : "Propor"}</button>
            <button type="button" disabled={ocupado} onClick={() => { setPropondo(false); setNome(""); setErro(null); }} className={estilos.botaoFantasma}>Cancelar</button>
          </div>
        )}
        {erro && <p role="alert" className={styles.erro}>{erro}</p>}
      </div>

      <div className={styles.campo} role="group" aria-label="Habilidades">
        <span className={styles.rotulo}>Habilidades {habilidadeIds.length > 0 && <span className={styles.contagem}>({habilidadeIds.length})</span>}</span>
        {motivoSemHabilidades
          ? <p className={styles.dica}>{motivoSemHabilidades}</p>
          : daArea.length === 0
          ? <p className={styles.dica}>Nenhuma habilidade cadastrada para esta área.</p>
          : (
            <>
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar habilidade" aria-label="Buscar habilidade" disabled={desabilitado} className={estilos.input} />
              <div className={styles.lista}>
                {visiveis.length === 0 && <p className={styles.vazio}>Nenhuma habilidade encontrada.</p>}
                {visiveis.map((h) => (
                  <label key={h.id} className={styles.item} data-marcada={habilidadeIds.includes(h.id)}>
                    <input type="checkbox" checked={habilidadeIds.includes(h.id)} disabled={desabilitado} onChange={() => alternar(h.id)} />
                    <span>
                      {h.codigo && <span className={styles.codigo}>{h.codigo} — </span>}{h.descricao}
                      {h.situacao === "proposto" && <span className={styles.proposto}> (proposto)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
