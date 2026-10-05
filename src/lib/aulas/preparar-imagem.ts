import { LIMITE_CAPA } from "./capas";

/** Normaliza a imagem no navegador antes de solicitar o envio ao armazenamento. */
export async function prepararImagemCapa(arquivo: File): Promise<File> {
  const url = URL.createObjectURL(arquivo);
  const imagem = new Image();
  try {
    imagem.src = url;
    await imagem.decode();
    if (!imagem.naturalWidth || !imagem.naturalHeight) throw new Error("Imagem vazia.");
    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Conversão indisponível.");
    let escala = Math.min(1, 1600 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      const qualidade = Math.max(0.6, 0.9 - tentativa * 0.05);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
      if (!blob) throw new Error("Conversão indisponível.");
      if (blob.size > 0 && blob.size <= LIMITE_CAPA) {
        return new File([blob], "capa.jpg", { type: "image/jpeg" });
      }
      escala *= 0.75;
    }
    throw new Error("Conversão indisponível.");
  } catch {
    throw new Error("Não foi possível abrir esta imagem. Escolha outro arquivo de imagem.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
