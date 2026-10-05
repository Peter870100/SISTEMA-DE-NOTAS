import { thumbnailAula } from "@/lib/aulas/capas";
import { ImagemCapa } from "./ImagemCapa";
export function MiniaturaAula({ caminho, videoId, porcentagem }: { caminho?: string | null; videoId: string | null; porcentagem?: number }) {
  return <span className="relative block aspect-video w-20 shrink-0 overflow-hidden rounded-control sm:w-24">
    <ImagemCapa src={thumbnailAula(caminho, videoId)} sizes="96px" />
    {porcentagem !== undefined && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 text-[10px] font-semibold text-white">{porcentagem}%</span>}
  </span>;
}
