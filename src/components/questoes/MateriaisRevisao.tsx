"use client";

import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { adicionarMaterial, removerMaterial } from "@/actions/classificacao";
import { nomeNormalizado } from "@/lib/questoes/classificacao";
import type { AulaOpcao } from "@/lib/questoes/classificacao-servidor";
import type { MaterialRevisao } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import type { Executar } from "./GerenciarClassificacao";
import styles from "./GerenciarClassificacao.module.css";

const MAX_OPCOES = 100;

type Props = {
  /** Material de um tópico ou de um assunto. */
  alvo: { topicoId: string } | { assuntoId: string };
  titulo: string;
  materiais: MaterialRevisao[];
  /** Aulas publicadas (para escolher) e as já usadas em materiais. */
  aulas: AulaOpcao[];
  executar: Executar;
  ocupado: boolean;
};

/** Materiais de revisão: uma aula publicada da plataforma (escolhida numa lista com busca) ou um link `https://` com título. */
export function MateriaisRevisao({ alvo, titulo, materiais, aulas, executar, ocupado }: Props) {
  const [tipo, setTipo] = useState<"aula" | "link">("aula");
  const [busca, setBusca] = useState("");
  const [aulaId, setAulaId] = useState("");
  const [tituloLink, setTituloLink] = useState("");
  const [url, setUrl] = useState("");

  const aulaPorId = useMemo(() => new Map(aulas.map((a) => [a.id, a])), [aulas]);
  const publicadas = useMemo(() => aulas.filter((a) => a.publicada), [aulas]);
  const filtradas = useMemo(() => {
    const q = nomeNormalizado(busca);
    return q ? publicadas.filter((a) => nomeNormalizado(`${a.titulo} ${a.curso}`).includes(q)) : publicadas;
  }, [publicadas, busca]);
  const opcoes = filtradas.slice(0, MAX_OPCOES);

  async function adicionarAula() {
    const aula = aulaPorId.get(aulaId);
    if (!aula) return;
    if (await executar(() => adicionarMaterial({ ...alvo, aulaId }), `Aula “${aula.titulo}” adicionada.`)) { setAulaId(""); setBusca(""); }
  }
  async function adicionarLink() {
    if (await executar(() => adicionarMaterial({ ...alvo, titulo: tituloLink, url }), `Link “${tituloLink.trim()}” adicionado.`)) { setTituloLink(""); setUrl(""); }
  }

  return (
    <div className={styles.bloco}>
      <h4>{titulo}</h4>
      {materiais.length === 0
        ? <p className={styles.vazio}>Nenhum material.</p>
        : (
          <ul className={styles.fichas}>
            {materiais.map((m) => {
              const aula = m.aula_id ? aulaPorId.get(m.aula_id) : null;
              const nome = m.aula_id ? (aula?.titulo ?? "Aula") : (m.titulo ?? "Link");
              return (
                <li key={m.id} className={styles.ficha}>
                  {m.aula_id ? <BookOpen size={16} aria-hidden="true" /> : <ExternalLink size={16} aria-hidden="true" />}
                  <span>
                    {m.url?.startsWith("https://")
                      ? <a href={m.url} target="_blank" rel="noopener noreferrer">{nome}</a>
                      : nome}
                    <small>{m.aula_id ? `Aula · ${aula?.curso ?? "curso"}${aula && !aula.publicada ? " · não publicada" : ""}` : m.url}</small>
                  </span>
                  <button type="button" disabled={ocupado} aria-label={`Remover o material ${nome}`} className={styles.tirar}
                    onClick={() => void executar(() => removerMaterial(m.id), `Material “${nome}” removido.`)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      <div className={styles.adicionar}>
        <div className={styles.modos} role="radiogroup" aria-label="Tipo de material">
          <label><input type="radio" checked={tipo === "aula"} onChange={() => setTipo("aula")} /> Aula da plataforma</label>
          <label><input type="radio" checked={tipo === "link"} onChange={() => setTipo("link")} /> Link</label>
        </div>
        {tipo === "aula" ? (
          publicadas.length === 0
            ? <p className={styles.vazio}>Nenhuma aula publicada para escolher.</p>
            : (
              <>
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aula ou curso" aria-label="Buscar aula" className={estilos.input} />
                <select value={opcoes.some((a) => a.id === aulaId) ? aulaId : ""} onChange={(e) => setAulaId(e.target.value)} aria-label="Aula publicada" className={estilos.input}>
                  <option value="">{filtradas.length === 0 ? "Nenhuma aula encontrada" : "Escolha a aula…"}</option>
                  {opcoes.map((a) => <option key={a.id} value={a.id}>{a.curso} — {a.titulo}</option>)}
                </select>
                {filtradas.length > MAX_OPCOES && <p className={styles.vazio}>Mostrando {MAX_OPCOES} de {filtradas.length}. Refine a busca.</p>}
                <button type="button" disabled={ocupado || !aulaId || !opcoes.some((a) => a.id === aulaId)} onClick={() => void adicionarAula()} className={estilos.botaoSecundario}>Adicionar aula</button>
              </>
            )
        ) : (
          <>
            <div className={styles.linhaCampos}>
              <input value={tituloLink} maxLength={160} onChange={(e) => setTituloLink(e.target.value)} placeholder="Título do material" aria-label="Título do link" className={estilos.input} />
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Endereço do link (https://)" className={estilos.input} />
            </div>
            <button type="button" disabled={ocupado || !tituloLink.trim() || !url.trim()} onClick={() => void adicionarLink()} className={estilos.botaoSecundario}>Adicionar link</button>
          </>
        )}
      </div>
    </div>
  );
}
