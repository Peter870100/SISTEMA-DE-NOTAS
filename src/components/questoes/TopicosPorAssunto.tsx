"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { aprovarTopico, juntarTopicosAction, renomearTopico } from "@/actions/classificacao";
import type { GerenciamentoClassificacao } from "@/lib/questoes/classificacao-pagina";
import { MATERIAS } from "@/lib/questoes/materias";
import type { Assunto, MaterialRevisao, Topico } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import type { Executar } from "./GerenciarClassificacao";
import { MateriaisRevisao } from "./MateriaisRevisao";
import { PrerequisitosTopico, type ItemBusca } from "./PrerequisitosTopico";
import styles from "./GerenciarClassificacao.module.css";

const rotuloMateria = (m: string) => MATERIAS[m as keyof typeof MATERIAS]?.rotulo ?? m;
const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

type Contexto = { todos: ItemBusca[]; dados: GerenciamentoClassificacao; executar: Executar; ocupado: boolean };

type Props = { assuntos: Assunto[]; dados: GerenciamentoClassificacao; executar: Executar; ocupado: boolean };

/** Tópicos de cada assunto: nº de questões, aprovar, renomear, juntar, pré-requisitos e materiais. */
export function TopicosPorAssunto({ assuntos, dados, executar, ocupado }: Props) {
  const porAssunto = useMemo(() => {
    const mapa = new Map<string, Topico[]>();
    for (const t of dados.topicos) mapa.set(t.assunto_id, [...(mapa.get(t.assunto_id) ?? []), t]);
    for (const lista of mapa.values()) lista.sort(porNome);
    return mapa;
  }, [dados.topicos]);

  const [materia, setMateria] = useState<string>(() => {
    const comTopicos = Object.keys(MATERIAS).find((m) => assuntos.some((a) => a.materia === m && porAssunto.has(a.id)));
    return comTopicos ?? Object.keys(MATERIAS)[0];
  });
  const [assuntoId, setAssuntoId] = useState("");
  const [soPropostos, setSoPropostos] = useState(false);

  // Busca de pré-requisitos: tópicos de qualquer matéria, com "Matéria · Assunto" como rótulo.
  const todos = useMemo<ItemBusca[]>(() => {
    const assuntoPorId = new Map(assuntos.map((a) => [a.id, a]));
    return dados.topicos.map((t) => {
      const a = assuntoPorId.get(t.assunto_id);
      return { id: t.id, nome: t.nome, rotulo: a ? `${rotuloMateria(a.materia)} · ${a.nome}` : "" };
    });
  }, [assuntos, dados.topicos]);

  const prerequisitosPor = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of dados.prerequisitos) mapa.set(p.topico_id, [...(mapa.get(p.topico_id) ?? []), p.prerequisito_id]);
    return mapa;
  }, [dados.prerequisitos]);

  const materiaisPor = useMemo(() => {
    const mapa = new Map<string, MaterialRevisao[]>();
    for (const m of dados.materiais) {
      const chave = m.topico_id ?? m.assunto_id;
      if (chave) mapa.set(chave, [...(mapa.get(chave) ?? []), m]);
    }
    return mapa;
  }, [dados.materiais]);

  const assuntosDaMateria = useMemo(() => assuntos.filter((a) => a.materia === materia).sort(porNome), [assuntos, materia]);
  const grupos = assuntosDaMateria
    .filter((a) => !assuntoId || a.id === assuntoId)
    .map((a) => ({ assunto: a, topicos: (porAssunto.get(a.id) ?? []).filter((t) => !soPropostos || t.situacao === "proposto") }))
    .filter((g) => assuntoId || g.topicos.length > 0);
  const total = grupos.reduce((soma, g) => soma + g.topicos.length, 0);
  const contexto: Contexto = { todos, dados, executar, ocupado };

  return (
    <>
      <div className={`${estilos.card} ${styles.filtros}`}>
        <label>Matéria
          <select value={materia} onChange={(e) => { setMateria(e.target.value); setAssuntoId(""); }} className={estilos.input}>
            {Object.keys(MATERIAS).map((m) => <option key={m} value={m}>{rotuloMateria(m)}</option>)}
          </select>
        </label>
        <label>Assunto
          <select value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)} className={estilos.input}>
            <option value="">Todos os assuntos</option>
            {assuntosDaMateria.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.situacao === "proposto" ? " (proposto)" : ""}</option>)}
          </select>
        </label>
        <label className={styles.marca}><input type="checkbox" checked={soPropostos} onChange={(e) => setSoPropostos(e.target.checked)} /> Só propostos</label>
        <span className={styles.resumo}>{total.toLocaleString("pt-BR")} {total === 1 ? "tópico" : "tópicos"}</span>
      </div>

      {grupos.length === 0 && (
        <p className={`${estilos.card} p-4 text-sm text-ink`}>
          {soPropostos ? "Nenhum tópico proposto nesta matéria." : "Esta matéria ainda não tem tópicos."}
        </p>
      )}

      {grupos.map(({ assunto, topicos }) => (
        <section key={assunto.id} className={`${estilos.card} ${styles.grupo}`} aria-label={assunto.nome}>
          <h3>{assunto.nome}{assunto.situacao === "proposto" && <span className={styles.selo}>proposto</span>}
            <small>{topicos.length} {topicos.length === 1 ? "tópico" : "tópicos"}</small></h3>
          {topicos.length === 0 && <p className={styles.vazio}>{soPropostos ? "Nenhum tópico proposto neste assunto." : "Este assunto ainda não tem tópicos."}</p>}
          <ul className={styles.lista}>
            {topicos.map((t) => (
              <TopicoLinha key={t.id} topico={t} irmaos={(porAssunto.get(assunto.id) ?? []).filter((x) => x.id !== t.id)}
                nQuestoes={dados.questoesPorTopico[t.id] ?? 0} prerequisitos={prerequisitosPor.get(t.id) ?? []}
                materiais={materiaisPor.get(t.id) ?? []} contexto={contexto} />
            ))}
          </ul>
          {assuntoId === assunto.id && (
            <div className={`${styles.detalhes} mt-3`}>
              <MateriaisRevisao alvo={{ assuntoId: assunto.id }} titulo="Materiais do assunto" materiais={materiaisPor.get(assunto.id) ?? []}
                aulas={dados.aulas} executar={executar} ocupado={ocupado} />
            </div>
          )}
        </section>
      ))}
    </>
  );
}

type LinhaProps = {
  topico: Topico;
  /** Outros tópicos do mesmo assunto: destinos possíveis ao juntar. */
  irmaos: Topico[];
  nQuestoes: number;
  prerequisitos: string[];
  materiais: MaterialRevisao[];
  contexto: Contexto;
};

function TopicoLinha({ topico, irmaos, nQuestoes, prerequisitos, materiais, contexto }: LinhaProps) {
  const { todos, dados, executar, ocupado } = contexto;
  const [modo, setModo] = useState<"nenhum" | "renomear" | "juntar">("nenhum");
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(topico.nome);
  const [destinoId, setDestinoId] = useState("");
  const destino = irmaos.find((t) => t.id === destinoId);

  async function renomear() {
    if (await executar(() => renomearTopico(topico.id, nome), `Tópico renomeado para “${nome.trim()}”.`)) setModo("nenhum");
  }
  async function juntar() {
    if (!destino) return;
    if (await executar(() => juntarTopicosAction(topico.id, destino.id), `“${topico.nome}” foi juntado a “${destino.nome}”.`)) setModo("nenhum");
  }

  return (
    <li className={styles.item}>
      <div className={styles.linha}>
        <div className={styles.nome}>
          <strong>{topico.nome}</strong>
          {topico.situacao === "proposto" && <span className={styles.selo}>proposto</span>}
          <span className={styles.numeros}>
            {nQuestoes.toLocaleString("pt-BR")} {nQuestoes === 1 ? "questão" : "questões"}
            {prerequisitos.length > 0 && ` · ${prerequisitos.length} ${prerequisitos.length === 1 ? "pré-requisito" : "pré-requisitos"}`}
            {materiais.length > 0 && ` · ${materiais.length} ${materiais.length === 1 ? "material" : "materiais"}`}
          </span>
        </div>
        <div className={styles.acoes}>
          {topico.situacao === "proposto" && (
            <button type="button" disabled={ocupado} onClick={() => void executar(() => aprovarTopico(topico.id), `“${topico.nome}” aprovado.`)} className={estilos.botaoPrimario}>Aprovar</button>
          )}
          <button type="button" disabled={ocupado} onClick={() => { setNome(topico.nome); setModo(modo === "renomear" ? "nenhum" : "renomear"); }} className={estilos.botaoSecundario}>Renomear</button>
          <button type="button" disabled={ocupado || irmaos.length === 0} title={irmaos.length === 0 ? "Não há outro tópico neste assunto" : undefined}
            onClick={() => { setDestinoId(""); setModo(modo === "juntar" ? "nenhum" : "juntar"); }} className={estilos.botaoSecundario}>Juntar com…</button>
          <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={estilos.botaoFantasma}>
            Pré-requisitos e materiais {aberto ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {modo === "renomear" && (
        <div className={styles.edicao}>
          <input value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} aria-label={`Novo nome de ${topico.nome}`} className={estilos.input}
            onKeyDown={(e) => { if (e.key === "Enter" && nome.trim()) void renomear(); }} />
          <button type="button" disabled={ocupado || !nome.trim()} onClick={() => void renomear()} className={estilos.botaoPrimario}>Salvar nome</button>
          <button type="button" onClick={() => setModo("nenhum")} className={estilos.botaoFantasma}>Cancelar</button>
        </div>
      )}

      {modo === "juntar" && (
        <div className={styles.edicao}>
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} aria-label={`Juntar ${topico.nome} com`} className={estilos.input}>
            <option value="">Escolha o tópico que fica…</option>
            {irmaos.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.situacao === "proposto" ? " (proposto)" : ""}</option>)}
          </select>
          {destino && (
            <p>As questões, os pré-requisitos e os materiais de “{topico.nome}” passam para “{destino.nome}”, e “{topico.nome}” é apagado. Não dá para desfazer.</p>
          )}
          <button type="button" disabled={ocupado || !destino} onClick={() => void juntar()} className={estilos.botaoPerigo}>Juntar e apagar “{topico.nome}”</button>
          <button type="button" onClick={() => setModo("nenhum")} className={estilos.botaoFantasma}>Cancelar</button>
        </div>
      )}

      {aberto && (
        <div className={styles.detalhes}>
          <PrerequisitosTopico topicoId={topico.id} atuais={prerequisitos} todos={todos} executar={executar} ocupado={ocupado} />
          <MateriaisRevisao alvo={{ topicoId: topico.id }} titulo="Materiais de revisão" materiais={materiais} aulas={dados.aulas} executar={executar} ocupado={ocupado} />
        </div>
      )}
    </li>
  );
}
