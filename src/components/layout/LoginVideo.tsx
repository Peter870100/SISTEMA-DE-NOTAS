"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import medio from "../../../public/segmento-medio.jpg";

export function LoginVideo({ cadastro = false }: { cadastro?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    function updatePlayback() {
      if (!video) return;
      if (motion.matches || connection?.saveData) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        return;
      }
      video.src = cadastro ? "/cadastro-status-loop.mp4" : "/login-status-loop.mp4";
      void video.play().catch(() => {});
    }
    updatePlayback();
    motion.addEventListener("change", updatePlayback);
    return () => {
      motion.removeEventListener("change", updatePlayback);
      video.pause();
    };
  }, [cadastro]);

  return (
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${cadastro ? "z-0" : "-z-10"}`}>
        <Image src={cadastro ? "/cadastro-status-poster.jpg" : medio} alt="" fill preload placeholder={cadastro ? "empty" : "blur"} sizes={cadastro ? "100vw" : "(min-width: 1024px) 65vw, 100vw"} className={cadastro ? "object-cover object-center" : "object-cover object-[center_15%] lg:w-[65%] lg:object-[center_22%]"} />
        <video ref={videoRef} muted loop playsInline preload="none"
          onPlaying={() => setReady(true)}
          onEmptied={() => setReady(false)} onError={() => setReady(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${cadastro ? "" : "lg:w-[65%]"} ${ready ? "opacity-100" : "opacity-0"}`}
        />
        <div className={cadastro ? "absolute inset-0 bg-frame-deep/65" : "absolute inset-0 bg-frame-deep/80 lg:bg-[linear-gradient(90deg,rgba(6,32,86,0.72)_0%,rgba(6,32,86,0.65)_40%,rgba(6,32,86,0.94)_65%,#062056_85%)]"} />
      </div>
  );
}
