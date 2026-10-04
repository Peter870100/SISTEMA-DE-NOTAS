"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { concluirAulaSemVideo, registrarProgresso } from "@/actions/progresso";
import type { ProvedorVideo } from "@/lib/types";
import { PlayerVideo } from "@/components/aulas/PlayerVideo";
import { estilos } from "@/components/ui/estilos";

type Props = {
  aulaId: string;
  video: { provedor: ProvedorVideo; id: string } | null;
  iniciarEm: number;
  porcentagemInicial: number;
  concluidaInicial: boolean;
};

export function AulaAluno({ aulaId, video, iniciarEm, porcentagemInicial, concluidaInicial }: Props) {
  const router = useRouter();
  const [porcentagem, setPorcentagem] = useState(porcentagemInicial);
  const [concluida, setConcluida] = useState(concluidaInicial);
  const [erro, setErro] = useState<string | null>(null);

  const aoTempo = useCallback((posicao: number) => {
    registrarProgresso(aulaId, posicao)
      .then((r) => {
        setPorcentagem(r.porcentagem);
        if (r.concluida && !concluida) { setConcluida(true); router.refresh(); }
      })
      .catch(() => setErro("Não conseguimos salvar seu progresso agora. Ele volta a ser salvo sozinho."));
  }, [aulaId, concluida, router]);

  return (
    <div className="flex flex-col gap-3">
      {video ? (
        <>
          <PlayerVideo provedor={video.provedor} videoId={video.id} iniciarEm={iniciarEm} onTempo={aoTempo} />
          <div className="flex items-center gap-3">
            <div className="flex-1"><BarraProgresso porcentagem={porcentagem} rotulo="Quanto do vídeo você assistiu" /></div>
            <span className={`text-sm font-semibold ${concluida ? "text-ok" : "text-muted"}`}>
              {concluida ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={15} aria-hidden="true" /> Concluída</span> : `${porcentagem}% assistido`}
            </span>
          </div>
        </>
      ) : concluida ? (
        <p className="inline-flex items-center gap-1 text-sm font-semibold text-ok"><CheckCircle2 size={15} aria-hidden="true" /> Concluída</p>
      ) : (
        <button type="button" onClick={async () => {
          try { await concluirAulaSemVideo(aulaId); setConcluida(true); router.refresh(); }
          catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
        }} className={`${estilos.botaoPrimario} w-fit`}>Concluir aula</button>
      )}
      {erro && <p role="status" className="text-xs text-muted">{erro}</p>}
    </div>
  );
}

export function BarraProgresso({ porcentagem, rotulo }: { porcentagem: number; rotulo: string }) {
  return (
    <div role="progressbar" aria-valuenow={porcentagem} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo} className="h-2 w-full overflow-hidden rounded bg-surface-sunken">
      <div className="h-full bg-brand" style={{ width: `${porcentagem}%` }} />
    </div>
  );
}
