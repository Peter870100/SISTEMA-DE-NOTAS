"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { areaRecorte } from "@/lib/recorte-avatar";
import css from "./AvatarAluno.module.css";

export function RecorteAvatar({ foto, onAplicar, onCancelar }: { foto: string; onAplicar: (foto: string) => void; onCancelar: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  useEffect(() => {
    let ativo = true;
    const fotoOriginal = new Image();
    fotoOriginal.onload = () => { if (ativo) setImagem(fotoOriginal); };
    fotoOriginal.onerror = () => { if (ativo) setErro(true); };
    fotoOriginal.src = foto;
    return () => { ativo = false; };
  }, [foto]);
  useEffect(() => {
    const contexto = canvas.current?.getContext("2d");
    if (!contexto || !imagem) return;
    const { x, y, lado } = areaRecorte(imagem.naturalWidth, imagem.naturalHeight, zoom, horizontal, vertical);
    contexto.fillStyle = "#ffffff"; contexto.fillRect(0, 0, 256, 256);
    contexto.drawImage(imagem, x, y, lado, lado, 0, 0, 256, 256);
  }, [imagem, zoom, horizontal, vertical]);
  return <section className={css.recorte} aria-label="Recortar foto de perfil">
    <p className={css.rotulo}>Ajuste sua foto</p>
    <p className={css.ajuda}>Escolha o zoom e a posição. A prévia mostra como a foto ficará no perfil.</p>
    <canvas ref={canvas} width={256} height={256} className={css.canvas} role="img" aria-label="Previa circular do recorte da foto" />
    {erro && <p className={css.erro} role="alert">Não foi possível abrir a foto para recortar.</p>}
    <label className={css.ajuste}>Zoom <output>{Math.round(zoom * 100)}%</output><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
    <label className={css.ajuste}>Posição horizontal<input type="range" min="0" max="100" value={horizontal} onChange={e => setHorizontal(Number(e.target.value))} /></label>
    <label className={css.ajuste}>Posição vertical<input type="range" min="0" max="100" value={vertical} onChange={e => setVertical(Number(e.target.value))} /></label>
    <button type="button" className={css.foto} onClick={() => { setZoom(1); setHorizontal(50); setVertical(50); }}><RotateCcw size={16} /> Centralizar</button>
    <div className={css.acoes}><button type="button" className={css.foto} onClick={onCancelar}><X size={16} /> Cancelar</button><button type="button" className={css.salvar} disabled={!imagem || erro} onClick={() => { if (canvas.current) onAplicar(canvas.current.toDataURL("image/jpeg", .85)); }}><Check size={17} /> Usar recorte</button></div>
  </section>;
}
