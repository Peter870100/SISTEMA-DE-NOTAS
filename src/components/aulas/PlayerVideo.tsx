"use client";

import { useEffect, useRef } from "react";
import type { ProvedorVideo } from "@/lib/types";

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    host?: string;
    playerVars?: Record<string, number | string>;
    events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
  }) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let carregandoApi: Promise<YTNamespace> | null = null;
function carregarApiYoutube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  carregandoApi ??= new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); resolve(window.YT!); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return carregandoApi;
}

type Props = {
  provedor: ProvedorVideo;
  videoId: string;
  iniciarEm: number;
  onTempo: (posicaoSeg: number, duracaoSeg: number) => void;
  onDuracao?: (duracaoSeg: number) => void;
};

const INTERVALO_MS = 15_000;

/** Player do vídeo da aula. Hoje só YouTube; Bunny entra como outro ramo com a mesma interface. */
export function PlayerVideo({ provedor, videoId, iniciarEm, onTempo, onDuracao }: Props) {
  const alvo = useRef<HTMLDivElement>(null);
  const aoTempo = useRef(onTempo);
  useEffect(() => { aoTempo.current = onTempo; }, [onTempo]);
  const aoDuracao = useRef(onDuracao);
  useEffect(() => { aoDuracao.current = onDuracao; }, [onDuracao]);
  // Posição inicial só vale na montagem: mudar depois não deve recriar o player.
  const inicio = useRef(iniciarEm);

  useEffect(() => {
    if (provedor !== "youtube" || !alvo.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelado = false;
    let pronto = false;
    let duracaoInformada = false;

    const informarDuracao = () => {
      if (duracaoInformada || !player) return;
      const duracao = player.getDuration();
      if (duracao > 0) {
        duracaoInformada = true;
        aoDuracao.current?.(Math.round(duracao));
      }
    };

    const informar = () => {
      if (!player || !pronto) return;
      const duracao = player.getDuration();
      if (duracao > 0) aoTempo.current(player.getCurrentTime(), duracao);
    };
    const pararTimer = () => { if (timer) clearInterval(timer); timer = null; };
    const aoEsconder = () => { if (document.visibilityState === "hidden") informar(); };

    void carregarApiYoutube().then((YT) => {
      if (cancelado || !alvo.current) return;
      player = new YT.Player(alvo.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { start: Math.max(0, Math.floor(inicio.current)), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { pronto = true; informarDuracao(); },
          onStateChange: (e) => {
            informarDuracao();
            if (e.data === YT.PlayerState.PLAYING) {
              pararTimer();
              timer = setInterval(informar, INTERVALO_MS);
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              pararTimer();
              informar();
            }
          },
        },
      });
    });
    document.addEventListener("visibilitychange", aoEsconder);

    return () => {
      cancelado = true;
      try {
        pararTimer();
        informar();
      } finally {
        document.removeEventListener("visibilitychange", aoEsconder);
        player?.destroy();
      }
    };
  }, [provedor, videoId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
      <div ref={alvo} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
    </div>
  );
}
