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
    events?: { onStateChange?: (e: { data: number }) => void };
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
};

const INTERVALO_MS = 15_000;

/** Player do vídeo da aula. Hoje só YouTube; Bunny entra como outro ramo com a mesma interface. */
export function PlayerVideo({ provedor, videoId, iniciarEm, onTempo }: Props) {
  const alvo = useRef<HTMLDivElement>(null);
  const aoTempo = useRef(onTempo);
  useEffect(() => { aoTempo.current = onTempo; }, [onTempo]);

  useEffect(() => {
    if (provedor !== "youtube" || !alvo.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelado = false;

    const informar = () => {
      if (!player) return;
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
        playerVars: { start: Math.max(0, Math.floor(iniciarEm)), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
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
      pararTimer();
      informar();
      document.removeEventListener("visibilitychange", aoEsconder);
      player?.destroy();
    };
  }, [provedor, videoId, iniciarEm]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
      <div ref={alvo} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
    </div>
  );
}
