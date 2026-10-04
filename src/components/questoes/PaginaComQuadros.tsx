"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { atualizarRecorte } from "@/actions/questoes";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";

type Item = { id: string; alvo: string; quadro: Quadro };

export function PaginaComQuadros({ url, largura, altura, quadros }: { url: string; largura: number; altura: number; quadros: Item[] }) {
  const router = useRouter();
  const area = useRef<HTMLDivElement>(null);
  const [itens, setItens] = useState(quadros);
  const [erro, setErro] = useState<string | null>(null);
  const arraste = useRef<{ id: string; modo: "mover" | "redimensionar"; x0: number; y0: number; q0: Quadro } | null>(null);

  function fracao(e: React.PointerEvent) {
    const r = area.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  function iniciar(e: React.PointerEvent, item: Item, modo: "mover" | "redimensionar") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = fracao(e);
    arraste.current = { id: item.id, modo, x0: p.x, y0: p.y, q0: item.quadro };
  }

  function mover(e: React.PointerEvent) {
    const a = arraste.current;
    if (!a) return;
    const p = fracao(e);
    const dx = p.x - a.x0, dy = p.y - a.y0;
    const q = a.modo === "mover" ? { ...a.q0, x: Math.min(Math.max(a.q0.x + dx, 0), 1 - a.q0.w), y: Math.min(Math.max(a.q0.y + dy, 0), 1 - a.q0.h) } : { ...a.q0, w: a.q0.w + dx, h: a.q0.h + dy };
    setItens((lista) => lista.map((i) => (i.id === a.id ? { ...i, quadro: limitarQuadro(q) } : i)));
  }

  async function soltar() {
    const a = arraste.current;
    arraste.current = null;
    if (!a) return;
    const item = itens.find((i) => i.id === a.id);
    if (!item) return;
    const q0 = a.q0, q = item.quadro;
    if (q.x === q0.x && q.y === q0.y && q.w === q0.w && q.h === q0.h) return;
    try { await atualizarRecorte(item.id, item.quadro); setErro(null); router.refresh(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar o recorte."); }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <div ref={area} onPointerMove={mover} onPointerUp={() => void soltar()} onPointerCancel={() => { arraste.current = null; }} className="relative touch-none w-full select-none overflow-hidden rounded border border-line" style={{ aspectRatio: `${largura} / ${altura}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Página original da prova" className="absolute inset-0 h-full w-full" draggable={false} />
        {itens.map((i) => (
          <div key={i.id} onPointerDown={(e) => iniciar(e, i, "mover")} className="absolute cursor-move border-2 border-brand bg-brand/10"
            style={{ left: `${i.quadro.x * 100}%`, top: `${i.quadro.y * 100}%`, width: `${i.quadro.w * 100}%`, height: `${i.quadro.h * 100}%` }}
            aria-label={`Recorte da figura (${i.alvo})`}>
            <span className="absolute left-0 top-0 bg-brand px-1 text-[10px] font-bold text-white">{i.alvo}</span>
            <span onPointerDown={(e) => iniciar(e, i, "redimensionar")} className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-brand" aria-hidden="true" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Arraste o quadro para mover; puxe o canto azul para ajustar o tamanho.</p>
    </div>
  );
}
