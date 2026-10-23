// Desenho de páginas de PDF em JPEG no servidor (Node), com os mesmos números da tela
// "Importar prova" (src/components/questoes/ImportarProva.tsx): 150 dpi, largura máxima 1600,
// fundo branco, JPEG qualidade 0,8. Só para uso no servidor (rotas com runtime "nodejs").
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const LARGURA_MAX = 1600;
const QUALIDADE_JPEG = 80; // 0,8 da tela

export type PaginaDesenhada = { jpeg: Buffer; largura: number; altura: number };
export type PdfServidor = {
  numPaginas: number;
  desenhar(n: number): Promise<PaginaDesenhada>;
  fechar(): Promise<void>;
};

/** Escala da página: 150 dpi, sem passar de 1600 px de largura. */
export function escalaPagina(larguraBase: number): number {
  return Math.min(150 / 72, LARGURA_MAX / larguraBase);
}

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let carregado: Promise<Pdfjs> | null = null;

/** Carrega o pdfjs sem worker: o "worker" roda na mesma thread (o pdfjs procura `globalThis.pdfjsWorker`). */
function carregarPdfjs(): Promise<Pdfjs> {
  carregado ??= (async () => {
    const g = globalThis as { pdfjsWorker?: unknown };
    if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return carregado;
}

/** Pasta de dados do pdfjs (fontes padrão, CMaps, wasm), lida do disco pelo próprio pdfjs no Node. */
function pastaPdfjs(sub: string): string {
  return join(process.cwd(), "node_modules", "pdfjs-dist", sub) + "/";
}

export async function abrirPdfServidor(bytes: Uint8Array): Promise<PdfServidor> {
  const pdfjs = await carregarPdfjs();
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(bytes), // cópia: o pdfjs pode transferir/alterar o buffer
    useSystemFonts: false,
    standardFontDataUrl: pastaPdfjs("standard_fonts"),
    cMapUrl: pastaPdfjs("cmaps"),
    cMapPacked: true,
    wasmUrl: pastaPdfjs("wasm"),
    verbosity: 0,
  });
  let doc: Awaited<typeof tarefa.promise>;
  try {
    doc = await tarefa.promise;
  } catch (erro) {
    await tarefa.destroy().catch(() => {});
    if ((erro as { name?: string })?.name === "PasswordException") throw new Error("O PDF está protegido por senha.");
    throw new Error("Não consegui abrir o PDF.");
  }

  return {
    numPaginas: doc.numPages,
    async desenhar(n) {
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: escalaPagina(base.width) });
        const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // O canvas do @napi-rs/canvas faz o papel do HTMLCanvasElement no Node.
        await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
        const jpeg = await canvas.encode("jpeg", QUALIDADE_JPEG);
        return { jpeg, largura: canvas.width, altura: canvas.height };
      } finally {
        page.cleanup();
      }
    },
    async fechar() {
      await tarefa.destroy();
    },
  };
}
