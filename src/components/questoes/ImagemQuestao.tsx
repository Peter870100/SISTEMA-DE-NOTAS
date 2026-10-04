import { estiloRecorte, type Quadro } from "@/lib/questoes/quadro";
import type { AlvoImagem } from "@/lib/types";

export type ImagemTela = { id: string; alvo: AlvoImagem; tipo: "recorte" | "arquivo"; url: string; quadro: Quadro | null; largura: number | null; altura: number | null };

export function ImagemQuestao({ imagem }: { imagem: ImagemTela }) {
  if (imagem.tipo === "arquivo" || !imagem.quadro || !imagem.largura || !imagem.altura) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imagem.url} alt="Figura da questão" className="max-h-96 max-w-full rounded border border-line" />;
  }
  const e = estiloRecorte(imagem.quadro, imagem.largura, imagem.altura);
  return (
    <div role="img" aria-label="Figura da questão" className="w-full max-w-xl rounded border border-line bg-no-repeat"
      style={{ backgroundImage: `url(${JSON.stringify(imagem.url)})`, backgroundSize: e.backgroundSize, backgroundPosition: e.backgroundPosition, aspectRatio: e.aspectRatio }} />
  );
}
