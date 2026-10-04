"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { definirPublicacao, salvarAula, type DadosAula } from "@/actions/cursos";
import { extrairIdYoutube } from "@/lib/aulas/youtube";
import type { Aula, RegraGabarito } from "@/lib/types";
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
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const idPrevia = link.trim() ? extrairIdYoutube(link) : null;
  const dados = (): DadosAula => ({ titulo, texto, linkVideo: link, gabarito_liberacao: regra, gabarito_libera_em: regra === "data" && liberaEm ? new Date(liberaEm).toISOString() : null });

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await acao(); setAviso(mensagem); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }

  function publicar() {
    if (!idPrevia && !temArquivos && !window.confirm("Esta aula está vazia. Publicar mesmo assim?")) return;
    void executar(async () => { await salvarAula(aula.id, dados()); await definirPublicacao(aula.id, true); }, "Aula publicada. Os alunos já podem ver.");
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>}
      {aviso && <p role="status" className="rounded-control bg-ok/15 px-3 py-2 text-sm text-ink">{aviso}</p>}
      <label className="flex flex-col gap-1 text-xs text-muted">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={estilos.input} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Link do vídeo do YouTube (opcional)
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" className={estilos.input} />
      </label>
      {link.trim() && !idPrevia && <p className="text-sm text-danger">Link do YouTube não reconhecido.</p>}
      {idPrevia && (
        <div className="aspect-video w-full max-w-xl overflow-hidden rounded-card bg-black">
          <iframe src={`https://www.youtube-nocookie.com/embed/${idPrevia}`} title="Prévia do vídeo" className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">Texto da aula (opcional)<textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={estilos.input} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-muted">Quando o gabarito aparece para o aluno</legend>
        {([["junto", "Junto com o material"], ["apos_concluir", "Depois que ele concluir a aula"], ["data", "A partir de uma data"]] as const).map(([valor, rotulo]) => (
          <label key={valor} className="flex items-center gap-2 text-sm text-ink"><input type="radio" name="regra" checked={regra === valor} onChange={() => setRegra(valor)} /> {rotulo}</label>
        ))}
        {regra === "data" && <input type="datetime-local" value={liberaEm} onChange={(e) => setLiberaEm(e.target.value)} aria-label="Data de liberação do gabarito" className={`${estilos.input} max-w-xs`} />}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => executar(() => salvarAula(aula.id, dados()), aula.publicada ? "Alterações salvas." : "Rascunho salvo.")} className={estilos.botaoSecundario}>{aula.publicada ? "Salvar alterações" : "Salvar rascunho"}</button>
        {aula.publicada ? (
          <button type="button" disabled={ocupado} onClick={() => executar(() => definirPublicacao(aula.id, false), "A aula voltou para rascunho e saiu da área dos alunos.")} className={estilos.botaoFantasma}>Voltar para rascunho</button>
        ) : (
          <button type="button" disabled={ocupado} onClick={publicar} className={estilos.botaoPrimario}>Publicar</button>
        )}
      </div>
    </div>
  );
}
