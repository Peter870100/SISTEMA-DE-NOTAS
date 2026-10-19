"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { estiloRecorte, type Quadro } from "@/lib/questoes/quadro";
import { justificarAlinhamento } from "@/lib/questoes/conferencia";
import type { Alinhamento, AlvoImagem } from "@/lib/types";

export type ImagemTela = { id: string; alvo: AlvoImagem; tipo: "recorte" | "arquivo"; url: string; quadro: Quadro | null; largura: number | null; altura: number | null; alinhamento: Alinhamento; paginaId: string | null };

/** Sem link (url vazia) ou erro ao carregar: mostra o aviso em vez de sumir com a figura. */
export function ImagemIndisponivel() {
  return (
    <div role="img" aria-label="Imagem da questão indisponível"
      className="flex w-full max-w-xl items-center gap-3 rounded border border-dashed border-danger bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
      <ImageOff size={20} aria-hidden="true" className="shrink-0" />
      <span>Imagem indisponível. Avise o professor.</span>
    </div>
  );
}

export function ImagemQuestao({ imagem }: { imagem: ImagemTela }) {
  const [falhou, setFalhou] = useState(false);
  if (!imagem.url || falhou) return <ImagemIndisponivel />;
  let figura: React.ReactNode;
  if (imagem.tipo === "arquivo" || !imagem.quadro || !imagem.largura || !imagem.altura) {
    // eslint-disable-next-line @next/next/no-img-element
    figura = <img src={imagem.url} alt="Figura da questão" onError={() => setFalhou(true)} className="max-h-96 max-w-full rounded border border-line" />;
  } else {
    const e = estiloRecorte(imagem.quadro, imagem.largura, imagem.altura);
    figura = (
      <>
        {/* background-image não avisa quando falha: a cópia escondida detecta o erro. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagem.url} alt="" hidden onError={() => setFalhou(true)} />
        <div role="img" aria-label="Figura da questão" className="w-full max-w-xl rounded border border-line bg-no-repeat"
          style={{ backgroundImage: `url(${JSON.stringify(imagem.url)})`, backgroundSize: e.backgroundSize, backgroundPosition: e.backgroundPosition, aspectRatio: e.aspectRatio }} />
      </>
    );
  }
  return <div className="flex" style={{ justifyContent: justificarAlinhamento(imagem.alinhamento) }}>{figura}</div>;
}
