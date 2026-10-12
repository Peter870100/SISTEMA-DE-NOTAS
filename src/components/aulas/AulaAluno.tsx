"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { concluirAulaSemVideo, registrarProgresso } from "@/actions/progresso";
import type { ProvedorVideo } from "@/lib/types";
import { PlayerVideo } from "@/components/aulas/PlayerVideo";
import { estilos } from "@/components/ui/estilos";
import { QuizAulaAluno } from "./QuizAulaAluno";
import type { QuizAlunoDados } from "@/lib/aulas/quiz";
import { ProgressoCurso } from "./ProgressoCurso";
import css from "./AulaAluno.module.css";

type Props = {
  aulaId: string;
  quiz?: QuizAlunoDados | null;
  video: { provedor: ProvedorVideo; id: string } | null;
  iniciarEm: number;
  porcentagemInicial: number;
  concluidaInicial: boolean;
};

export function AulaAluno({ aulaId, video, iniciarEm, porcentagemInicial, concluidaInicial, quiz }: Props) {
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
    <div className={css.aula}>
      {video ? (
        <>
          <div className={css.player}><PlayerVideo provedor={video.provedor} videoId={video.id} iniciarEm={iniciarEm} onTempo={aoTempo} /></div>
          <div className={css.resumo}>
            <div className={css.cabecalhoProgresso}>
              <p>Seu progresso nesta aula</p>
              <span className={css.estado}>{concluida ? <><CheckCircle2 size={17} aria-hidden="true" />Concluída</> : "Assistido"}</span>
            </div>
            <ProgressoCurso porcentagem={porcentagem} rotulo="Quanto do vídeo você assistiu" />
          </div>
        </>
      ) : concluida ? (
        <p className={css.semVideo}><CheckCircle2 size={15} aria-hidden="true" /> Concluída</p>
      ) : (
        <button type="button" onClick={async () => {
          try { await concluirAulaSemVideo(aulaId); setConcluida(true); router.refresh(); }
          catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
        }} className={`${estilos.botaoPrimario} ${css.concluir}`}>Concluir aula</button>
      )}
      {erro && <p role="status" className={css.erro}>{erro}</p>}
      {quiz && <QuizAulaAluno key={quiz.versao} aulaId={aulaId} quiz={quiz} concluida={concluida} />}
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
