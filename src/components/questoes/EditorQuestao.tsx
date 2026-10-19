"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, Tags, FileText, ListChecks, Save, CheckCircle2 } from "lucide-react";
import { criarQuestao, definirAlinhamento, excluirQuestao, marcarConferida, marcarFaltaImagem, prepararEnvioImagem, publicarQuestao, registrarImagem, removerImagem, salvarQuestao, type DadosQuestao } from "@/actions/questoes";
import { LETRAS, MATERIAS } from "@/lib/questoes/materias";
import type { Alinhamento, AlvoImagem, Assunto, Letra, Questao } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { EntradaImagem } from "./EntradaImagem";
import { ImagemQuestao, type ImagemTela } from "./ImagemQuestao";
import { TextoQuestao } from "./TextoQuestao";

import styles from "./EditorQuestao.module.css";

type Props = {
  questao: Questao | null;
  imagens: ImagemTela[];
  assuntos: Assunto[];
  podeEscolherGeral: boolean;
  aoSalvar?: (id: string) => void;
  modoRevisao?: boolean;
  proximaHref?: string | null;
};

async function enviarImagem(url: string, arquivo: File) {
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", arquivo, arquivo.name);
  const r = await fetch(url, { method: "PUT", body: corpo, headers: { "x-upsert": "false" } });
  if (!r.ok) throw new Error("Falha ao enviar imagem.");
}

type Pendente = { id: string; alvo: AlvoImagem; arquivo: File };

const POSICOES: { valor: Alinhamento; simbolo: string; rotulo: string }[] = [
  { valor: "esquerda", simbolo: "◧", rotulo: "Figura à esquerda" },
  { valor: "centro", simbolo: "▣", rotulo: "Figura no centro" },
  { valor: "direita", simbolo: "◨", rotulo: "Figura à direita" },
];

// A URL é criada e revogada no próprio efeito: seguro no StrictMode (o remonte cria outra).
function MiniaturaPendente({ arquivo }: { arquivo: File }) {
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    if (img.current) img.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} alt="Imagem a enviar ao criar a questão" className="max-h-40 max-w-full rounded-control border border-line object-contain" />;
}

export function EditorQuestao({ questao, imagens, assuntos, podeEscolherGeral, aoSalvar, modoRevisao = false, proximaHref = null }: Props) {
  const router = useRouter();
  const [d, setD] = useState<DadosQuestao>(() => ({
    banca: questao?.banca ?? "Própria",
    ano: questao?.ano ?? new Date().getFullYear(),
    caderno: questao?.caderno ?? "",
    numero: questao?.numero ?? null,
    materia: questao?.materia ?? "portugues",
    assunto_id: questao?.assunto_id ?? null,
    enunciado: questao?.enunciado ?? "",
    comando: questao?.comando ?? "",
    alternativas: LETRAS.map((letra) => ({ letra, texto: questao?.alternativas.find((a) => a.letra === letra)?.texto ?? "" })),
    resposta: questao?.resposta ?? null,
    anulada: questao?.anulada ?? false,
    escopo: questao?.escopo ?? "escola",
  }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);

  const assuntosMateria = assuntos.filter((a) => a.materia === d.materia);
  const set = <K extends keyof DadosQuestao>(k: K, v: DadosQuestao[K]) => setD((x) => ({ ...x, [k]: v }));

  async function executar(acao: () => Promise<void>, msg?: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); if (msg) setAviso(msg); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  async function salvar(): Promise<string> {
    if (questao) { await salvarQuestao(questao.id, d); aoSalvar?.(questao.id); return questao.id; }
    const id = await criarQuestao(d);
    aoSalvar?.(id);
    let falha: string | null = null;
    for (const p of pendentes) {
      try {
        const { signedUrl, storagePath } = await prepararEnvioImagem(id, p.arquivo.name, p.arquivo.size, p.arquivo.type);
        await enviarImagem(signedUrl, p.arquivo);
        await registrarImagem(id, p.alvo, storagePath, null);
      } catch (e) {
        falha = e instanceof Error ? e.message : "Falha ao enviar imagem.";
        break;
      }
    }
    // A questão já existe: sempre vai para a página dela (evita criar duplicada).
    if (falha) window.alert(`A questão foi criada, mas uma imagem não foi enviada: ${falha}
Adicione as imagens novamente nesta página.`);
    router.push(`/banco/questoes/${id}`);
    return id;
  }

  async function enviarPara(alvo: AlvoImagem, arquivo: File, substituirId: string | null) {
    if (!questao) throw new Error("Salve a questão antes de adicionar imagens.");
    const { signedUrl, storagePath } = await prepararEnvioImagem(questao.id, arquivo.name, arquivo.size, arquivo.type);
    await enviarImagem(signedUrl, arquivo);
    await registrarImagem(questao.id, alvo, storagePath, substituirId);
  }

  function blocoImagens(alvo: AlvoImagem) {
    const lista = imagens.filter((i) => i.alvo === alvo);
    const fila = pendentes.filter((p) => p.alvo === alvo);
    return (
      <div className="flex flex-col gap-2">
        {lista.map((img) => (
          <div key={img.id} className="flex flex-col gap-1">
            <ImagemQuestao imagem={img} />
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Posição da figura" className="flex gap-1">
                {POSICOES.map((p) => (
                  <button key={p.valor} type="button" aria-label={p.rotulo} title={p.rotulo} aria-pressed={img.alinhamento === p.valor} disabled={ocupado}
                    onClick={() => void executar(() => definirAlinhamento(img.id, p.valor))}
                    className={`${estilos.botaoFantasma} px-2 text-xs ${img.alinhamento === p.valor ? "bg-gold/25 text-brand" : ""}`}>{p.simbolo}</button>
                ))}
              </div>
              <label className={`${estilos.botaoFantasma} cursor-pointer px-2 text-xs`}><Upload size={13} aria-hidden="true" /> Trocar imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(() => enviarPara(alvo, f, img.id)); }} />
              </label>
              <button type="button" onClick={() => void executar(() => removerImagem(img.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
            </div>
          </div>
        ))}
        {fila.map((p) => (
          <div key={p.id} className="flex flex-col items-start gap-1">
            <MiniaturaPendente arquivo={p.arquivo} />
            <button type="button" onClick={() => setPendentes((x) => x.filter((y) => y.id !== p.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
          </div>
        ))}
        <EntradaImagem
          rotulo={lista.length + fila.length ? "Adicionar outra imagem" : "Adicionar imagem"}
          desabilitado={ocupado}
          aoEscolher={async (arquivo) => {
            if (questao) { await enviarPara(alvo, arquivo, null); router.refresh(); }
            else setPendentes((x) => [...x, { id: crypto.randomUUID(), alvo, arquivo }]);
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
    <div className={styles.editor}>
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      {questao?.falta_imagem && <p role="status" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">⚠ Esta questão está marcada como “falta imagem” e não entra em simulados novos.</p>}
      {questao?.precisa_revisao && questao.motivo_revisao && <p className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">⚠ {questao.motivo_revisao}</p>}

      <section className={`${styles.card} ${styles.metadata}`} aria-label="Identificação da questão">
      <div className={styles.heading}><span className={styles.icon}><Tags size={22} aria-hidden="true" /></span><div><h2>Identificação da questão</h2><p>Organize a origem, a matéria e o assunto.</p></div></div>
      <div className={styles.metadataFields}>
        <label className="flex flex-col gap-1 text-xs text-muted">Banca<input value={d.banca} onChange={(e) => set("banca", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ano<input value={d.ano ?? ""} onChange={(e) => set("ano", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Caderno<input value={d.caderno} onChange={(e) => set("caderno", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Nº<input value={d.numero ?? ""} onChange={(e) => set("numero", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
      </div>
      <div className={styles.subjectFields}>
        <label className="flex flex-col gap-1 text-xs text-muted">Matéria
          <select value={d.materia} onChange={(e) => { set("materia", e.target.value); set("assunto_id", null); }} className={estilos.input}>
            {Object.entries(MATERIAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Assunto
          <select value={d.assunto_id ?? ""} onChange={(e) => set("assunto_id", e.target.value || null)} className={estilos.input}>
            <option value="">— sem assunto —</option>
            {assuntosMateria.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.situacao === "proposto" ? " (proposto)" : ""}</option>)}
          </select>
        </label>
      </div>
      {podeEscolherGeral && !questao && (
        <label className="flex flex-col gap-1 text-xs text-muted">Banco
          <select value={d.escopo} onChange={(e) => set("escopo", e.target.value as "geral" | "escola")} className={estilos.input}>
            <option value="escola">Questões da minha escola</option>
            <option value="geral">Banco geral</option>
          </select>
        </label>
      )}

      </section>
      <section className={`${styles.card} ${styles.statement}`} aria-label="Enunciado e comando">
      <div className={styles.heading}><span className={styles.icon}><FileText size={22} aria-hidden="true" /></span><div><h2>Enunciado e comando</h2><p>Prepare o texto que será apresentado ao aluno.</p></div></div>
      <div className="flex items-center justify-between"><span className={estilos.rotulo}>Enunciado</span><button type="button" aria-pressed={previa} onClick={() => setPrevia(!previa)} className={styles.previewToggle}>{previa ? "Editar texto" : "Ver como fica"}</button></div>
      {previa ? <div className={styles.preview}><TextoQuestao texto={d.enunciado} /></div> : <textarea value={d.enunciado} onChange={(e) => set("enunciado", e.target.value)} rows={10} className={estilos.input} aria-label="Enunciado" />}
      <p className="text-xs text-muted">Use **negrito** e *itálico*. Quebre linhas normalmente.</p>
      {blocoImagens("enunciado")}
      <label className="flex flex-col gap-1 text-xs text-muted">Comando<input value={d.comando} onChange={(e) => set("comando", e.target.value)} className={estilos.input} /></label>

      </section>
      <fieldset className={`${styles.card} ${styles.answers}`}>
        <legend className="sr-only">Alternativas e resposta</legend>
        <div className={styles.heading}><span className={styles.icon}><ListChecks size={22} aria-hidden="true" /></span><div><h2>Alternativas e resposta</h2><p>Marque a letra que corresponde ao gabarito.</p></div>{d.resposta && <span className={styles.badge}><CheckCircle2 size={16} aria-hidden="true" /> Gabarito {d.resposta}</span>}</div>
        {LETRAS.map((letra) => (
          <div key={letra} className={styles.answer} data-selected={d.resposta === letra}>
            <div className={styles.answerRow}>
              <label className={styles.letter}><input type="radio" name="resposta" checked={d.resposta === letra} onChange={() => set("resposta", letra as Letra)} aria-label={`Resposta ${letra}`} /><span>{letra}</span></label>
              <textarea value={d.alternativas.find((a) => a.letra === letra)!.texto} onChange={(e) => set("alternativas", d.alternativas.map((a) => (a.letra === letra ? { ...a, texto: e.target.value } : a)))} rows={2} className={estilos.input} aria-label={`Alternativa ${letra}`} />
            </div>
            {blocoImagens(letra)}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={d.anulada} onChange={(e) => set("anulada", e.target.checked)} /> Questão anulada</label>
      </fieldset>

      <div className={styles.actions} aria-busy={ocupado}>
        <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); }, "Salvo.")} className={styles.primary}><Save size={18} aria-hidden="true" />{ocupado ? "Aguarde…" : questao ? "Salvar questão" : "Criar questão"}</button>
        {questao && modoRevisao && (
          <>
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await marcarFaltaImagem(questao.id); }, "Marcada como falta imagem.")} className={`${estilos.botaoSecundario} border-danger text-danger`}>⚠ Falta imagem</button>
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await marcarConferida(questao.id); if (proximaHref) router.push(proximaHref); }, "Conferida.")} className={styles.primary}><CheckCircle2 size={18} aria-hidden="true" />✓ Conferida — próxima</button>
          </>
        )}
        {questao && !modoRevisao && (questao.status === "publicada"
          ? <button type="button" disabled={ocupado} onClick={() => void executar(() => publicarQuestao(questao.id, false), "Voltou para revisão.")} className={estilos.botaoFantasma}>Voltar para revisão</button>
          : <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await publicarQuestao(questao.id, true); }, "Publicada.")} className={styles.publish}><CheckCircle2 size={18} aria-hidden="true" />Publicar</button>)}
        {questao && <button type="button" disabled={ocupado} onClick={() => { if (window.confirm("Excluir esta questão?")) void executar(async () => { await excluirQuestao(questao.id); router.push(proximaHref ?? "/banco"); }); }} className={`${estilos.botaoFantasma} text-danger`}>Excluir</button>}
      </div>
    </div>
    </div>
  );
}
