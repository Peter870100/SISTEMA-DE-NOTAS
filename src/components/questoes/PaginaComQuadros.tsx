"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { atualizarRecorte, criarRecorte } from "@/actions/questoes";
import { estilos } from "@/components/ui/estilos";
import { quadroDoArraste } from "@/lib/questoes/conferencia";
import { LETRAS } from "@/lib/questoes/materias";
import { limitarQuadro, type Quadro } from "@/lib/questoes/quadro";
import type { AlvoImagem } from "@/lib/types";

type Item = { id: string; alvo: string; quadro: Quadro };

type Props = { url: string; largura: number; altura: number; quadros: Item[]; questaoId: string; paginaId: string; anteriorHref: string | null; seguinteHref: string | null };

const limitar01 = (n: number) => Math.min(Math.max(n, 0), 1);

function NavPagina({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (href) return <Link href={href} className={estilos.botaoSecundario}>{children}</Link>;
  return <span aria-disabled="true" className={`${estilos.botaoSecundario} cursor-not-allowed opacity-50`}>{children}</span>;
}

export function PaginaComQuadros({ url, largura, altura, quadros, questaoId, paginaId, anteriorHref, seguinteHref }: Props) {
  const router = useRouter();
  const area = useRef<HTMLDivElement>(null);
  const [itens, setItens] = useState(quadros);
  const [erro, setErro] = useState<string | null>(null);
  const [modoRecorte, setModoRecorte] = useState(false);
  const [previa, setPrevia] = useState<Quadro | null>(null);
  const [pendente, setPendente] = useState<Quadro | null>(null);
  const [alvo, setAlvo] = useState<AlvoImagem>("enunciado");
  const [salvando, setSalvando] = useState(false);
  const novo = useRef<{ x0: number; y0: number } | null>(null);
  const arraste = useRef<{ id: string; modo: "mover" | "redimensionar"; x0: number; y0: number; q0: Quadro } | null>(null);
  const chaveQuadros = quadros.map((q) => `${q.id}:${q.quadro.x},${q.quadro.y},${q.quadro.w},${q.quadro.h}`).join("|");
  const [anterior, setAnterior] = useState({ chaveQuadros, paginaId });
  if (anterior.chaveQuadros !== chaveQuadros || anterior.paginaId !== paginaId) {
    const trocouPagina = anterior.paginaId !== paginaId;
    setAnterior({ chaveQuadros, paginaId });
    setItens(quadros);
    if (trocouPagina) { setModoRecorte(false); setPendente(null); setPrevia(null); setErro(null); }
  }

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

  function iniciarNovo(e: React.PointerEvent) {
    if (!modoRecorte || salvando || e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    area.current!.setPointerCapture(e.pointerId);
    const p = fracao(e);
    novo.current = { x0: limitar01(p.x), y0: limitar01(p.y) };
    setPendente(null);
    setPrevia(null);
  }

  function quadroNovo(e: React.PointerEvent) {
    const n = novo.current!;
    const p = fracao(e);
    return quadroDoArraste({ x: n.x0, y: n.y0 }, { x: limitar01(p.x), y: limitar01(p.y) });
  }

  function mover(e: React.PointerEvent) {
    if (novo.current) { setPrevia(quadroNovo(e)); return; }
    const a = arraste.current;
    if (!a) return;
    const p = fracao(e);
    const dx = p.x - a.x0, dy = p.y - a.y0;
    const q = a.modo === "mover" ? { ...a.q0, x: Math.min(Math.max(a.q0.x + dx, 0), 1 - a.q0.w), y: Math.min(Math.max(a.q0.y + dy, 0), 1 - a.q0.h) } : { ...a.q0, w: a.q0.w + dx, h: a.q0.h + dy };
    setItens((lista) => lista.map((i) => (i.id === a.id ? { ...i, quadro: limitarQuadro(q) } : i)));
  }

  async function usarRecorte() {
    if (!pendente) return;
    setSalvando(true);
    try {
      await criarRecorte(questaoId, paginaId, alvo, pendente);
      setErro(null); setPendente(null); setModoRecorte(false);
      router.refresh();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar o recorte."); }
    finally { setSalvando(false); }
  }

  function cancelarRecorte() { setPendente(null); setPrevia(null); }

  function alternarModo() {
    setModoRecorte((v) => !v);
    cancelarRecorte();
    novo.current = null;
  }

  async function soltar(e: React.PointerEvent) {
    if (novo.current) {
      const q = quadroNovo(e);
      novo.current = null;
      setPrevia(null);
      if (q) setPendente(q);
      return;
    }
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
      <div className="flex flex-wrap items-center gap-2">
        <NavPagina href={anteriorHref}>◀ página anterior</NavPagina>
        <button type="button" aria-pressed={modoRecorte} disabled={salvando} onClick={alternarModo} className={modoRecorte ? estilos.botaoPrimario : estilos.botaoSecundario}>✂ Recortar figura</button>
        <NavPagina href={seguinteHref}>página seguinte ▶</NavPagina>
      </div>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <div ref={area} onPointerDown={iniciarNovo} onPointerMove={mover} onPointerUp={(e) => void soltar(e)} onPointerCancel={() => { arraste.current = null; novo.current = null; setPrevia(null); }} className={`relative touch-none w-full select-none overflow-hidden rounded border border-line ${modoRecorte ? "cursor-crosshair" : ""}`} style={{ aspectRatio: `${largura} / ${altura}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Página original da prova" className="absolute inset-0 h-full w-full" draggable={false} />
        {itens.map((i) => (
          <div key={i.id} onPointerDown={(e) => iniciar(e, i, "mover")} className={`absolute cursor-move border-2 border-brand bg-brand/10 ${modoRecorte ? "pointer-events-none" : ""}`}
            style={{ left: `${i.quadro.x * 100}%`, top: `${i.quadro.y * 100}%`, width: `${i.quadro.w * 100}%`, height: `${i.quadro.h * 100}%` }}
            aria-label={`Recorte da figura (${i.alvo})`}>
            <span className="absolute left-0 top-0 bg-brand px-1 text-[10px] font-bold text-white">{i.alvo}</span>
            <span onPointerDown={(e) => iniciar(e, i, "redimensionar")} className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-brand" aria-hidden="true" />
          </div>
        ))}
        {(previa ?? pendente) && (
          <div className="pointer-events-none absolute border-2 border-dashed border-gold bg-gold/20"
            style={{ left: `${(previa ?? pendente)!.x * 100}%`, top: `${(previa ?? pendente)!.y * 100}%`, width: `${(previa ?? pendente)!.w * 100}%`, height: `${(previa ?? pendente)!.h * 100}%` }} aria-hidden="true" />
        )}
      </div>
      {pendente && (
        <div role="group" aria-label="Destino do recorte" className={`${estilos.card} flex flex-wrap items-center gap-2 p-2 text-sm text-ink`}>
          <label className="flex items-center gap-2 font-semibold">Vai para:
            <select value={alvo} onChange={(e) => setAlvo(e.target.value as AlvoImagem)} disabled={salvando} className={`${estilos.input} w-auto`}>
              <option value="enunciado">Enunciado</option>
              {LETRAS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void usarRecorte()} disabled={salvando} className={`${estilos.botaoPrimario} !bg-gold !text-gold-ink hover:!bg-gold/90`}>{salvando ? "Salvando…" : "Usar recorte"}</button>
          <button type="button" onClick={cancelarRecorte} disabled={salvando} className={estilos.botaoSecundario}>Cancelar</button>
        </div>
      )}
      <p className="text-xs text-ink">Arraste o quadro para mover; puxe o canto azul para ajustar o tamanho. Para recortar uma figura nova, use “✂ Recortar figura” e arraste sobre a página.</p>
    </div>
  );
}
