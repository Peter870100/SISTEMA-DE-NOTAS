"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { definirPublicacao, salvarAula, type DadosAula } from "@/actions/cursos";
import { extrairIdYoutube } from "@/lib/aulas/youtube";
import { PlayerVideo } from "@/components/aulas/PlayerVideo";
import type { Aula, RegraGabarito } from "@/lib/types";
import { EscolherCapa } from "./EscolherCapa";
import { ImagemCapa } from "./ImagemCapa";
import { thumbnailAula } from "@/lib/aulas/capas";
import { estilos } from "@/components/ui/estilos";

type Props = { aula: Aula; temArquivos: boolean };

function paraInputData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditorAula({ aula, temArquivos }: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(aula.titulo);
  const [texto, setTexto] = useState(aula.texto ?? "");
  const [link, setLink] = useState(aula.video_id ? `https://www.youtube.com/watch?v=${aula.video_id}` : "");
  const [regra, setRegra] = useState<RegraGabarito>(aula.gabarito_liberacao);
  const [liberaEm, setLiberaEm] = useState(paraInputData(aula.gabarito_libera_em));
  const [duracao, setDuracao] = useState<number | null>(aula.duracao_seg);
  const [capa, setCapa] = useState(aula.capa_caminho ?? null);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const idPrevia = link.trim() ? extrairIdYoutube(link) : null;
  const dados = (): DadosAula => ({ capa_caminho: capa === (aula.capa_caminho ?? null) ? undefined : capa, titulo, texto, linkVideo: link, duracaoSeg: idPrevia ? duracao : null, gabarito_liberacao: regra, gabarito_libera_em: regra === "data" && liberaEm ? new Date(liberaEm).toISOString() : null });

  function salvar() {
    if (aula.publicada && idPrevia && duracao == null) { setErro("Espere a prévia do vídeo carregar para registrar a duração."); return; }
    void executar(() => salvarAula(aula.id, dados()), aula.publicada ? "Alterações salvas." : "Rascunho salvo.");
  }

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); setAviso(mensagem); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  function publicar() {
    if (idPrevia && duracao == null) { setErro("Espere a prévia do vídeo carregar para registrar a duração."); return; }
    if (!idPrevia && !temArquivos && !window.confirm("Esta aula está vazia. Publicar mesmo assim?")) return;
    void executar(async () => { await salvarAula(aula.id, dados()); await definirPublicacao(aula.id, true); }, "Aula publicada. Os alunos já podem ver.");
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Link do vídeo (opcional)
        <input value={link} onChange={(e) => { const v = e.target.value; if ((v.trim() ? extrairIdYoutube(v) : null) !== idPrevia) setDuracao(null); setLink(v); }} placeholder="https://youtu.be/…" className={estilos.input} />
      </label>
      {link.trim() && !idPrevia && <p className="text-sm text-danger">Link de vídeo não reconhecido. Use um link compatível.</p>}
      {idPrevia && (
        <div className="flex flex-col gap-1">
          <div className="w-full max-w-xl">
            <PlayerVideo key={idPrevia} provedor="youtube" videoId={idPrevia} iniciarEm={0} onTempo={() => {}} onDuracao={setDuracao} />
          </div>
          <p className="text-xs text-muted">
            {duracao != null ? `Duração: ${Math.floor(duracao / 60)}:${String(duracao % 60).padStart(2, "0")}` : "Carregando duração do vídeo… (se demorar, dê play na prévia)"}
          </p>
        </div>
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs text-muted">Miniatura da aula</legend>
        <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-control"><ImagemCapa src={thumbnailAula(capa, idPrevia)} sizes="320px" /></div>
        <EscolherCapa tipo="aula" aulaId={aula.id} caminho={capa} onChange={setCapa} onOcupado={setEnviandoCapa} disabled={ocupado || enviandoCapa} />
      </fieldset>
      <label className="flex flex-col gap-1 text-xs text-muted">Texto da aula (opcional)<textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">Quando o gabarito aparece para o aluno</legend>
        {([["junto", "Junto com o material"], ["apos_concluir", "Depois que ele concluir a aula"], ["data", "A partir de uma data"]] as const).map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-2 text-sm text-ink"><input type="radio" name="regra" checked={regra === valor} onChange={() => setRegra(valor)} /> {rotulo}</label>
        ))}
        {regra === "data" && <input type="datetime-local" value={liberaEm} onChange={(e) => setLiberaEm(e.target.value)} aria-label="Data de liberação do gabarito" className={`${estilos.input} max-w-xs`} />}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado || enviandoCapa} onClick={salvar} className={estilos.botaoSecundario}>{aula.publicada ? "Salvar alterações" : "Salvar rascunho"}</button>
        {aula.publicada ? (
          <button type="button" disabled={ocupado || enviandoCapa} onClick={() => executar(() => definirPublicacao(aula.id, false), "A aula voltou para rascunho e saiu da área dos alunos.")} className={estilos.botaoFantasma}>Voltar para rascunho</button>
        ) : (
          <button type="button" disabled={ocupado || enviandoCapa} onClick={publicar} className={estilos.botaoPrimario}>Publicar</button>
        )}
      </div>
    </div>
  );
}
