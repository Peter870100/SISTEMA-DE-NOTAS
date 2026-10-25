"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Upload, Tags, FileText, ListChecks, Save, CheckCircle2 } from "lucide-react";
import { criarQuestao, definirAlinhamento, excluirQuestao, marcarConferida, marcarFaltaImagem, prepararEnvioImagem, publicarQuestao, registrarImagem, removerImagem, salvarQuestao, type DadosQuestao } from "@/actions/questoes";
import { LETRAS, MATERIAS } from "@/lib/questoes/materias";
import { conteudoDeMarkdown, imagensDoConteudo, textoDoConteudo, trocarIdsFiguras, type DocConteudo } from "@/lib/questoes/conteudo";
import { colagemEhImagem } from "@/lib/questoes/colar";
import type { Alinhamento, AlvoImagem, Assunto, Letra, Questao } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { EntradaImagem, type EntradaImagemRef } from "./EntradaImagem";
import { ImagemQuestao, type ImagemTela } from "./ImagemQuestao";
import { ConteudoQuestao } from "./ConteudoQuestao";
import { EditorConteudo } from "./EditorConteudo";
import type { ImagensEditor } from "./editor/figura";

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
    // Sempre enviamos o documento (do enunciado e de cada alternativa): omitido, o servidor apagaria a formatação guardada.
    conteudo: questao?.conteudo ?? conteudoDeMarkdown(questao?.enunciado ?? ""),
    comando: questao?.comando ?? "",
    alternativas: LETRAS.map((letra) => {
      const alt = questao?.alternativas.find((a) => a.letra === letra);
      return { letra, texto: alt?.texto ?? "", conteudo: alt?.conteudo ?? conteudoDeMarkdown(alt?.texto ?? "") };
    }),
    resposta: questao?.resposta ?? null,
    anulada: questao?.anulada ?? false,
    escopo: questao?.escopo ?? "escola",
    resolucao: questao?.resolucao ?? "",
  }));
  const [ocupado, setOcupado] = useState(false);
  // Entradas de imagem por parte (enunciado, A..E): recebem imagens coladas nos textos.
  const entradas = useRef<Partial<Record<AlvoImagem, EntradaImagemRef | null>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  // Miniaturas locais (id provisório ou imagem recém-enviada ainda fora da lista do servidor).
  const [urlsLocais, setUrlsLocais] = useState<Record<string, string>>({});
  const urlsRef = useRef<string[]>([]);
  const acoesEnunciado = useRef<{ inserirFigura: (imagemId: string) => void } | null>(null);
  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const conteudoEnunciado = (d.conteudo ?? null) as DocConteudo | null;
  const citadas = useMemo(() => new Set(imagensDoConteudo(conteudoEnunciado)), [conteudoEnunciado]);
  // Mapa que as figuras do texto consultam para achar a URL; o servidor manda no que já conhece.
  const imagensEditor = useMemo(() => {
    const m: ImagensEditor = new Map(Object.entries(urlsLocais).map(([id, url]) => [id, { url }]));
    for (const i of imagens) m.set(i.id, { url: i.url, tela: i });
    return m;
  }, [imagens, urlsLocais]);
  const imagensPrevia = useMemo<ImagemTela[]>(() => [
    ...imagens,
    ...pendentes.filter((p) => urlsLocais[p.id]).map((p): ImagemTela => ({ id: p.id, alvo: p.alvo, tipo: "arquivo", url: urlsLocais[p.id], quadro: null, largura: null, altura: null, alinhamento: "centro", paginaId: null })),
  ], [imagens, pendentes, urlsLocais]);

  function guardarUrlLocal(id: string, arquivo: File) {
    const u = URL.createObjectURL(arquivo);
    urlsRef.current.push(u);
    setUrlsLocais((x) => ({ ...x, [id]: u }));
  }

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
    const reais = new Map<string, string>();
    for (const p of pendentes) {
      try {
        const { signedUrl, storagePath } = await prepararEnvioImagem(id, p.arquivo.name, p.arquivo.size, p.arquivo.type);
        await enviarImagem(signedUrl, p.arquivo);
        reais.set(p.id, await registrarImagem(id, p.alvo, storagePath, null));
      } catch (e) {
        falha = e instanceof Error ? e.message : "Falha ao enviar imagem.";
        break;
      }
    }
    // Figuras do texto ainda citam o id provisório: troca pelo real (e tira as que não subiram) e salva de novo.
    const provisorios = new Set(pendentes.map((p) => p.id));
    if (imagensDoConteudo(conteudoEnunciado).some((i) => provisorios.has(i))) {
      try { await salvarQuestao(id, { ...d, conteudo: trocarIdsFiguras(conteudoEnunciado, reais, provisorios) }); }
      catch (e) { falha ??= e instanceof Error ? e.message : "Falha ao salvar as figuras no texto."; }
    }
    // A questão já existe: sempre vai para a página dela (evita criar duplicada).
    if (falha) window.alert(`A questão foi criada, mas uma imagem não foi enviada: ${falha}
Adicione as imagens novamente nesta página.`);
    router.push(`/banco/questoes/${id}`);
    return id;
  }

  async function enviarPara(alvo: AlvoImagem, arquivo: File, substituirId: string | null): Promise<string> {
    if (!questao) throw new Error("Salve a questão antes de adicionar imagens.");
    const { signedUrl, storagePath } = await prepararEnvioImagem(questao.id, arquivo.name, arquivo.size, arquivo.type);
    await enviarImagem(signedUrl, arquivo);
    return registrarImagem(questao.id, alvo, storagePath, substituirId);
  }

  /** Figura inserida direto no texto do enunciado: devolve o id que o documento vai citar. */
  async function inserirNoTexto(arquivo: File): Promise<string> {
    // Mesmo controle de `executar` (Salvar fica desligado durante o envio), mas devolvendo o id.
    setOcupado(true); setErro(null); setAviso(null);
    try {
      if (questao) {
        const id = await enviarPara("enunciado", arquivo, null);
        guardarUrlLocal(id, arquivo);
        router.refresh();
        return id;
      }
      const id = crypto.randomUUID(); // provisório: vira o id real quando a questão for criada
      setPendentes((x) => [...x, { id, alvo: "enunciado", arquivo }]);
      guardarUrlLocal(id, arquivo);
      return id;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
      throw e;
    } finally {
      setOcupado(false);
    }
  }

  /** Colar um print dentro do texto: manda para o fluxo de imagem daquela parte; texto colado segue normal. */
  function colarImagem(alvo: AlvoImagem, e: React.ClipboardEvent) {
    if (ocupado) return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
    const arquivo = item?.getAsFile();
    if (!arquivo || !colagemEhImagem({ temArquivoImagem: true, texto: e.clipboardData.getData("text/plain"), html: e.clipboardData.getData("text/html") })) return;
    e.preventDefault();
    e.stopPropagation();
    entradas.current[alvo]?.receber(arquivo);
  }

  function blocoImagens(alvo: AlvoImagem) {
    // No enunciado, as figuras já citadas no texto aparecem lá; aqui ficam só as soltas.
    const lista = imagens.filter((i) => i.alvo === alvo && !(alvo === "enunciado" && citadas.has(i.id)));
    const fila = pendentes.filter((p) => p.alvo === alvo && !(alvo === "enunciado" && citadas.has(p.id)));
    const inserir = (id: string) => alvo === "enunciado" && (
      <button type="button" disabled={ocupado} onClick={() => acoesEnunciado.current?.inserirFigura(id)} className={`${estilos.botaoFantasma} px-2 text-xs`}>Inserir no texto</button>
    );
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
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(async () => { await enviarPara(alvo, f, img.id); }); }} />
              </label>
              {inserir(img.id)}
              <button type="button" onClick={() => void executar(() => removerImagem(img.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
            </div>
          </div>
        ))}
        {fila.map((p) => (
          <div key={p.id} className="flex flex-col items-start gap-1">
            <MiniaturaPendente arquivo={p.arquivo} />
            <div className="flex flex-wrap items-center gap-2">
              {inserir(p.id)}
              <button type="button" disabled={ocupado} onClick={() => setPendentes((x) => x.filter((y) => y.id !== p.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
            </div>
          </div>
        ))}
        <EntradaImagem
          rotulo={lista.length + fila.length ? "Adicionar outra imagem" : "Adicionar imagem"}
          desabilitado={ocupado}
          ref={(r) => { entradas.current[alvo] = r; }}
          aoEscolher={async (arquivo) => {
            if (questao) { await enviarPara(alvo, arquivo, null); router.refresh(); }
            else {
              const id = crypto.randomUUID();
              setPendentes((x) => [...x, { id, alvo, arquivo }]);
              if (alvo === "enunciado") guardarUrlLocal(id, arquivo);
            }
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
      {previa && <div className={styles.preview}><ConteudoQuestao doc={conteudoEnunciado} textoAntigo={d.enunciado} imagens={imagensPrevia} /></div>}
      {/* Fica montado (só escondido) para não perder cursor, desfazer nem o documento ao alternar a prévia. */}
      <div hidden={previa}>
        <EditorConteudo key={`${questao?.id ?? "nova"}-enunciado`} modo="enunciado" rotulo="Enunciado" valor={conteudoEnunciado} imagens={imagensEditor} acoesRef={acoesEnunciado}
          aoInserirImagem={inserirNoTexto}
          aoMudar={(doc) => setD((x) => ({ ...x, conteudo: doc, enunciado: textoDoConteudo(doc) }))} />
      </div>
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
              <div className="min-w-0 flex-1" onPasteCapture={(e) => colarImagem(letra, e)}>
                <EditorConteudo key={`${questao?.id ?? "nova"}-${letra}`} modo="alternativa" rotulo={`Alternativa ${letra}`} valor={(d.alternativas.find((a) => a.letra === letra)!.conteudo ?? null) as DocConteudo | null} imagens={imagensEditor}
                  aoMudar={(doc) => setD((x) => ({ ...x, alternativas: x.alternativas.map((a) => (a.letra === letra ? { ...a, texto: textoDoConteudo(doc), conteudo: doc } : a)) }))} />
              </div>
            </div>
            {blocoImagens(letra)}
          </div>
        ))}
        <label className="flex flex-col gap-1 text-xs text-ink">Resolução comentada (opcional)
          <textarea value={d.resolucao ?? ""} onChange={(ev) => set("resolucao", ev.target.value)} rows={5} maxLength={5000} className={estilos.input} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={d.anulada} onChange={(e) => set("anulada", e.target.checked)} /> Questão anulada</label>
      </fieldset>

      <div className={styles.actions} aria-busy={ocupado}>
        <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); }, "Salvo.")} className={styles.primary}><Save size={18} aria-hidden="true" />{ocupado ? "Aguarde…" : questao ? "Salvar questão" : "Criar questão"}</button>
        {questao && modoRevisao && (
          <>
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await marcarFaltaImagem(questao.id); }, "Marcada como falta imagem.")} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-danger bg-surface px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50">⚠ Falta imagem</button>
            <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await marcarConferida(questao.id); if (proximaHref) router.push(proximaHref); }, "Conferida.")} className={styles.primary}><CheckCircle2 size={18} aria-hidden="true" />✓ Conferida — próxima</button>
          </>
        )}
        {questao && !modoRevisao && (questao.status === "publicada"
          ? <button type="button" disabled={ocupado} onClick={() => void executar(() => publicarQuestao(questao.id, false), "Voltou para revisão.")} className={estilos.botaoFantasma}>Voltar para revisão</button>
          : <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await publicarQuestao(questao.id, true); }, "Publicada.")} className={styles.publish}><CheckCircle2 size={18} aria-hidden="true" />Publicar</button>)}
        {questao && <button type="button" disabled={ocupado} onClick={() => { if (window.confirm("Mandar esta questão para a Lixeira? Um administrador pode restaurá-la.")) void executar(async () => { await excluirQuestao(questao.id); router.push(proximaHref ?? "/banco"); }); }} className={`${estilos.botaoFantasma} text-danger`}>Excluir</button>}
      </div>
    </div>
    </div>
  );
}
