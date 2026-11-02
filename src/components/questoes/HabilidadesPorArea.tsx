"use client";

import { useMemo, useState } from "react";
import { aprovarHabilidade, criarHabilidade, juntarHabilidadesAction, renomearHabilidade } from "@/actions/classificacao";
import { AREAS } from "@/lib/questoes/materias";
import type { Area, Habilidade } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import type { Executar } from "./GerenciarClassificacao";
import styles from "./GerenciarClassificacao.module.css";

type Props = { habilidades: Habilidade[]; executar: Executar; ocupado: boolean };

/** Habilidades de uma área (valem para todas as matérias dela): criar, aprovar, renomear e juntar. */
export function HabilidadesPorArea({ habilidades, executar, ocupado }: Props) {
  const [area, setArea] = useState<Area>("linguagens");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const daArea = useMemo(() => habilidades.filter((h) => h.area === area), [habilidades, area]);

  async function criar() {
    const rotulo = codigo.trim() ? `${codigo.trim()} — ${descricao.trim()}` : descricao.trim();
    if (await executar(() => criarHabilidade(area, descricao, codigo.trim() || null), `Habilidade criada: ${rotulo}`)) { setCodigo(""); setDescricao(""); }
  }

  return (
    <>
      <div className={`${estilos.card} ${styles.filtros}`}>
        <label>Área
          <select value={area} onChange={(e) => setArea(e.target.value as Area)} className={estilos.input}>
            {(Object.entries(AREAS) as [Area, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <span className={styles.resumo}>{daArea.length.toLocaleString("pt-BR")} {daArea.length === 1 ? "habilidade" : "habilidades"}</span>
      </div>

      <form className={`${estilos.card} ${styles.novo}`} onSubmit={(e) => { e.preventDefault(); if (descricao.trim()) void criar(); }}>
        <label className={styles.curto}>Código (opcional)
          <input value={codigo} maxLength={20} onChange={(e) => setCodigo(e.target.value)} placeholder="H18" className={estilos.input} />
        </label>
        <label className={styles.largo}>Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={`Nova habilidade de ${AREAS[area]}`} className={estilos.input} />
        </label>
        <button type="submit" disabled={ocupado || !descricao.trim()} className={estilos.botaoPrimario}>Criar habilidade</button>
      </form>

      <section className={`${estilos.card} ${styles.grupo}`} aria-label={`Habilidades de ${AREAS[area]}`}>
        {daArea.length === 0
          ? <p className={styles.vazio}>Nenhuma habilidade cadastrada nesta área.</p>
          : (
            <ul className={styles.lista}>
              {daArea.map((h) => (
                <HabilidadeLinha key={h.id} habilidade={h} outras={daArea.filter((x) => x.id !== h.id)} executar={executar} ocupado={ocupado} />
              ))}
            </ul>
          )}
      </section>
    </>
  );
}

const rotulo = (h: Habilidade) => (h.codigo ? `${h.codigo} — ${h.descricao}` : h.descricao);

function HabilidadeLinha({ habilidade, outras, executar, ocupado }: { habilidade: Habilidade; outras: Habilidade[]; executar: Executar; ocupado: boolean }) {
  const [modo, setModo] = useState<"nenhum" | "renomear" | "juntar">("nenhum");
  const [codigo, setCodigo] = useState(habilidade.codigo ?? "");
  const [descricao, setDescricao] = useState(habilidade.descricao);
  const [destinoId, setDestinoId] = useState("");
  const destino = outras.find((h) => h.id === destinoId);

  async function salvar() {
    if (await executar(() => renomearHabilidade(habilidade.id, descricao, codigo.trim() || null), "Habilidade atualizada.")) setModo("nenhum");
  }
  async function juntar() {
    if (!destino) return;
    if (await executar(() => juntarHabilidadesAction(habilidade.id, destino.id), `Habilidade juntada a “${rotulo(destino)}”.`)) setModo("nenhum");
  }

  return (
    <li className={styles.item}>
      <div className={styles.linha}>
        <div className={styles.nome}>
          {habilidade.codigo && <span className={styles.codigo}>{habilidade.codigo}</span>}
          <span>{habilidade.descricao}</span>
          {habilidade.situacao === "proposto" && <span className={styles.selo}>proposta</span>}
        </div>
        <div className={styles.acoes}>
          {habilidade.situacao === "proposto" && (
            <button type="button" disabled={ocupado} onClick={() => void executar(() => aprovarHabilidade(habilidade.id), "Habilidade aprovada.")} className={estilos.botaoPrimario}>Aprovar</button>
          )}
          <button type="button" disabled={ocupado} onClick={() => { setCodigo(habilidade.codigo ?? ""); setDescricao(habilidade.descricao); setModo(modo === "renomear" ? "nenhum" : "renomear"); }} className={estilos.botaoSecundario}>Renomear</button>
          <button type="button" disabled={ocupado || outras.length === 0} title={outras.length === 0 ? "Não há outra habilidade nesta área" : undefined}
            onClick={() => { setDestinoId(""); setModo(modo === "juntar" ? "nenhum" : "juntar"); }} className={estilos.botaoSecundario}>Juntar com…</button>
        </div>
      </div>

      {modo === "renomear" && (
        <div className={styles.edicao}>
          <input value={codigo} maxLength={20} onChange={(e) => setCodigo(e.target.value)} placeholder="Código" aria-label="Código da habilidade" className={`${estilos.input} ${styles.curto}`} />
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Descrição da habilidade" className={`${estilos.input} ${styles.larga}`}
            onKeyDown={(e) => { if (e.key === "Enter" && descricao.trim()) void salvar(); }} />
          <button type="button" disabled={ocupado || !descricao.trim()} onClick={() => void salvar()} className={estilos.botaoPrimario}>Salvar</button>
          <button type="button" onClick={() => setModo("nenhum")} className={estilos.botaoFantasma}>Cancelar</button>
        </div>
      )}

      {modo === "juntar" && (
        <div className={styles.edicao}>
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} aria-label="Juntar com a habilidade" className={estilos.input}>
            <option value="">Escolha a habilidade que fica…</option>
            {outras.map((h) => <option key={h.id} value={h.id}>{rotulo(h)}{h.situacao === "proposto" ? " (proposta)" : ""}</option>)}
          </select>
          {destino && <p>As questões desta habilidade passam para “{rotulo(destino)}”, e esta habilidade é apagada. Não dá para desfazer.</p>}
          <button type="button" disabled={ocupado || !destino} onClick={() => void juntar()} className={estilos.botaoPerigo}>Juntar e apagar esta habilidade</button>
          <button type="button" onClick={() => setModo("nenhum")} className={estilos.botaoFantasma}>Cancelar</button>
        </div>
      )}
    </li>
  );
}
