"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pixelsDoQuadro, quadroDoArraste } from "@/lib/questoes/conferencia";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";
import estilos from "./EntradaImagem.module.css";

// Mesmo limite de TAMANHO_MAXIMO em src/actions/questoes.ts (arquivo "use server": não dá para importar).
const TAMANHO_MAXIMO = 5242880;

const INTEIRA: Quadro = { x: 0, y: 0, w: 1, h: 1 };

type Arraste =
  | { modo: "mover" | "redimensionar"; x0: number; y0: number; q0: Quadro }
  | { modo: "novo"; x0: number; y0: number };

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

function semExtensao(nome: string) {
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(0, i) : nome;
}

export function CortarImagem({
  arquivo,
  aoUsar,
  aoCancelar,
}: {
  arquivo: File;
  aoUsar: (cortado: File) => void;
  aoCancelar: () => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  // URL criada e revogada no mesmo efeito (seguro com o remonte do StrictMode).
  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    if (img.current) img.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);

  const dialogo = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const arraste = useRef<Arraste | null>(null);
  const cancelar = useRef(aoCancelar);
  const ocupado = useRef(false);
  useEffect(() => {
    cancelar.current = aoCancelar;
  });

  const [quadro, setQuadro] = useState<Quadro>(INTEIRA);
  const [carregada, setCarregada] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    dialogo.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape" && !ocupado.current) cancelar.current();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  function fracao(e: React.PointerEvent) {
    const r = area.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
    };
  }

  function iniciar(e: React.PointerEvent, modo: "mover" | "redimensionar" | "novo") {
    e.preventDefault();
    e.stopPropagation();
    area.current!.setPointerCapture(e.pointerId);
    const p = fracao(e);
    arraste.current = modo === "novo" ? { modo, x0: p.x, y0: p.y } : { modo, x0: p.x, y0: p.y, q0: quadro };
  }

  function mover(e: React.PointerEvent) {
    const a = arraste.current;
    if (!a) return;
    const p = fracao(e);
    if (a.modo === "novo") {
      const q = quadroDoArraste({ x: a.x0, y: a.y0 }, p);
      if (q) setQuadro(q);
      return;
    }
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (a.modo === "mover") {
      setQuadro({
        ...a.q0,
        x: Math.min(Math.max(a.q0.x + dx, 0), 1 - a.q0.w),
        y: Math.min(Math.max(a.q0.y + dy, 0), 1 - a.q0.h),
      });
    } else {
      setQuadro(limitarQuadro({ ...a.q0, w: a.q0.w + dx, h: a.q0.h + dy }));
    }
  }

  async function usar() {
    const el = img.current;
    if (!el || !carregada || gerando) return;
    ocupado.current = true;
    setGerando(true);
    setErro(null);
    try {
      const { sx, sy, sw, sh } = pixelsDoQuadro(quadro, el.naturalWidth, el.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem canvas");
      ctx.drawImage(el, sx, sy, sw, sh, 0, 0, sw, sh);
      let blob = await paraBlob(canvas, "image/png");
      let ext = "png";
      let tipo = "image/png";
      if (blob && blob.size > TAMANHO_MAXIMO) {
        blob = await paraBlob(canvas, "image/jpeg", 0.9);
        ext = "jpg";
        tipo = "image/jpeg";
      }
      if (!blob) throw new Error("sem blob");
      if (blob.size > TAMANHO_MAXIMO) {
        setErro("A imagem precisa ter até 5 MB.");
        return;
      }
      aoUsar(new File([blob], `${semExtensao(arquivo.name)}.${ext}`, { type: tipo }));
    } catch {
      setErro("Não foi possível cortar a imagem.");
    } finally {
      ocupado.current = false;
      setGerando(false);
    }
  }

  return (
    <div className={estilos.fundo}>
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cortar-imagem-titulo"
        tabIndex={-1}
        className={estilos.modal}
      >
        <h2 id="cortar-imagem-titulo" className={estilos.titulo}>Cortar imagem</h2>
        <div className={estilos.palco}>
          <div
            ref={area}
            className={estilos.area}
            onPointerDown={(e) => iniciar(e, "novo")}
            onPointerMove={mover}
            onPointerUp={() => { arraste.current = null; }}
            onPointerCancel={() => { arraste.current = null; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={img} alt="Imagem a cortar" className={estilos.imagem} draggable={false} onLoad={() => setCarregada(true)} />
            <div
              className={estilos.quadro}
              onPointerDown={(e) => iniciar(e, "mover")}
              style={{ left: `${quadro.x * 100}%`, top: `${quadro.y * 100}%`, width: `${quadro.w * 100}%`, height: `${quadro.h * 100}%` }}
              aria-label="Região a manter"
            >
              <span className={estilos.canto} onPointerDown={(e) => iniciar(e, "redimensionar")} aria-hidden="true" />
            </div>
          </div>
        </div>
        <p className={estilos.ajuda}>Arraste o quadro para mover, puxe o canto para ajustar ou desenhe um novo sobre a imagem.</p>
        {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
        <div className={estilos.acoes}>
          <button type="button" className={estilos.botaoSec} onClick={aoCancelar} disabled={gerando}>
            <X size={16} aria-hidden="true" /> Cancelar
          </button>
          <button type="button" className={estilos.botao} onClick={() => void usar()} disabled={!carregada || gerando}>
            <Check size={16} aria-hidden="true" /> {gerando ? "Cortando…" : "Usar"}
          </button>
        </div>
      </div>
    </div>
  );
}
