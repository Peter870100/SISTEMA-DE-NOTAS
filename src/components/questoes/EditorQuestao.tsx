"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { criarQuestao, excluirQuestao, prepararEnvioImagem, publicarQuestao, registrarImagem, removerImagem, salvarQuestao, type DadosQuestao } from "@/actions/questoes";
import { LETRAS, MATERIAS } from "@/lib/questoes/materias";
import type { AlvoImagem, Assunto, Letra, Questao } from "@/lib/types";
import { estilos } from "@/components/ui/estilos";
import { ImagemQuestao, type ImagemTela } from "./ImagemQuestao";
import { TextoQuestao } from "./TextoQuestao";

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
    const idInput = `img-${alvo}`;
    return (
      <div className="flex flex-col gap-2">
        {lista.map((img) => (
          <div key={img.id} className="flex flex-col gap-1">
            <ImagemQuestao imagem={img} />
            <div className="flex gap-2">
              <label className={`${estilos.botaoFantasma} cursor-pointer px-2 text-xs`}><Upload size={13} aria-hidden="true" /> Trocar imagem
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(() => enviarPara(alvo, f, img.id)); }} />
              </label>
              <button type="button" onClick={() => void executar(() => removerImagem(img.id))} className={`${estilos.botaoFantasma} px-2 text-xs`}><Trash2 size={13} aria-hidden="true" /> Remover</button>
            </div>
          </div>
        ))}
        {questao && (
          <label htmlFor={idInput} className={`${estilos.botaoFantasma} w-fit cursor-pointer px-2 text-xs`}><ImagePlus size={13} aria-hidden="true" /> {lista.length ? "+ Imagem" : "Adicionar imagem"}
            <input id={idInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void executar(() => enviarPara(alvo, f, null)); }} />
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      {questao?.precisa_revisao && questao.motivo_revisao && <p className="rounded-control bg-gold/25 px-3 py-2 text-sm text-ink">⚠ {questao.motivo_revisao}</p>}

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">Banca<input value={d.banca} onChange={(e) => set("banca", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ano<input value={d.ano ?? ""} onChange={(e) => set("ano", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Caderno<input value={d.caderno} onChange={(e) => set("caderno", e.target.value)} className={estilos.input} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Nº<input value={d.numero ?? ""} onChange={(e) => set("numero", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} inputMode="numeric" className={estilos.input} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
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

      <div className="flex items-center justify-between"><span className={estilos.rotulo}>Enunciado</span><button type="button" onClick={() => setPrevia(!previa)} className={`${estilos.botaoFantasma} px-2 text-xs`}>{previa ? "Editar texto" : "Ver como fica"}</button></div>
      {previa ? <TextoQuestao texto={d.enunciado} /> : <textarea value={d.enunciado} onChange={(e) => set("enunciado", e.target.value)} rows={8} className={estilos.input} aria-label="Enunciado" />}
      <p className="text-xs text-muted">Use **negrito** e *itálico*. Quebre linhas normalmente.</p>
      {blocoImagens("enunciado")}
      <label className="flex flex-col gap-1 text-xs text-muted">Comando<input value={d.comando} onChange={(e) => set("comando", e.target.value)} className={estilos.input} /></label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${estilos.rotulo} mb-1`}>Alternativas e resposta</legend>
        {LETRAS.map((letra) => (
          <div key={letra} className="flex flex-col gap-1 rounded-control border border-line p-2">
            <div className="flex items-start gap-2">
              <label className="flex items-center gap-1 pt-2 text-sm font-semibold text-ink"><input type="radio" name="resposta" checked={d.resposta === letra} onChange={() => set("resposta", letra as Letra)} aria-label={`Resposta ${letra}`} /> {letra})</label>
              <textarea value={d.alternativas.find((a) => a.letra === letra)!.texto} onChange={(e) => set("alternativas", d.alternativas.map((a) => (a.letra === letra ? { ...a, texto: e.target.value } : a)))} rows={2} className={estilos.input} aria-label={`Alternativa ${letra}`} />
            </div>
            {blocoImagens(letra)}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={d.anulada} onChange={(e) => set("anulada", e.target.checked)} /> Questão anulada</label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); }, "Salvo.")} className={estilos.botaoSecundario}>{questao ? "Salvar" : "Criar questão"}</button>
        {questao && (questao.status === "publicada"
          ? <button type="button" disabled={ocupado} onClick={() => void executar(() => publicarQuestao(questao.id, false), "Voltou para revisão.")} className={estilos.botaoFantasma}>Voltar para revisão</button>
          : <button type="button" disabled={ocupado} onClick={() => void executar(async () => { await salvar(); await publicarQuestao(questao.id, true); if (modoRevisao && proximaHref) router.push(proximaHref); }, "Publicada.")} className={estilos.botaoPrimario}>{modoRevisao ? "Aprovar e próxima" : "Publicar"}</button>)}
        {questao && <button type="button" disabled={ocupado} onClick={() => { if (window.confirm("Excluir esta questão?")) void executar(async () => { await excluirQuestao(questao.id); router.push(proximaHref ?? "/banco"); }); }} className={`${estilos.botaoFantasma} text-danger`}>Excluir</button>}
      </div>
    </div>
  );
}
