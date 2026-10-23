// Desenho de páginas de PDF em JPEG no servidor (Node), com os mesmos números da tela
// "Importar prova" (src/components/questoes/ImportarProva.tsx): 150 dpi, largura máxima 1600,
// fundo branco, JPEG qualidade 0,8. Só para uso no servidor (rotas com runtime "nodejs").
import { join } from "node:path";

const LARGURA_MAX = 1600;
const QUALIDADE_JPEG = 80; // 0,8 da tela
/** Limites do desenho: acima disso a página não é de prova (e o canvas comeria a memória da função). */
export const ALTURA_MAX = 20000;
export const PIXELS_MAX = 40_000_000;

/** O desenhador (pdfjs ou canvas nativo) não carregou: problema do servidor, não do PDF. */
export class DesenhoIndisponivel extends Error {
  override name = "DesenhoIndisponivel";
}
/** A página sairia grande demais para desenhar (depende só do PDF). */
export class PaginaGrandeDemais extends Error {
  override name = "PaginaGrandeDemais";
}

/** Tamanho do desenho em px, ou erro se passar dos limites (antes de criar o canvas). Pura. */
export function tamanhoDesenho(n: number, largura: number, altura: number): { largura: number; altura: number } {
  const l = Math.round(largura);
  const a = Math.round(altura);
  if (!(a <= ALTURA_MAX) || !(l * a <= PIXELS_MAX)) throw new PaginaGrandeDemais(`A página ${n} do PDF é grande demais para desenhar.`);
  return { largura: l, altura: a };
}

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

type Desenhador = {
  pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  createCanvas: typeof import("@napi-rs/canvas").createCanvas;
};
let carregado: Promise<Desenhador> | null = null;

/**
 * Carrega o pdfjs sem worker (o "worker" roda na mesma thread: o pdfjs procura `globalThis.pdfjsWorker`)
 * e o canvas nativo. Se falhar, esquece a promessa (a próxima chamada tenta de novo) e lança
 * `DesenhoIndisponivel`.
 */
export function carregarDesenhador(importar: () => Promise<Desenhador> = importarDesenhador): Promise<Desenhador> {
  carregado ??= importar().catch((e: unknown) => {
    carregado = null;
    throw new DesenhoIndisponivel(`O desenho de PDF não está disponível no servidor (${e instanceof Error ? e.message : String(e)}).`);
  });
  return carregado;
}

/** Só para testes: esquece o desenhador carregado. */
export function esquecerDesenhador(): void {
  carregado = null;
}

async function importarDesenhador(): Promise<Desenhador> {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const [pdfjs, { createCanvas }] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("@napi-rs/canvas")]);
  return { pdfjs, createCanvas };
}

/** Pasta de dados do pdfjs (fontes padrão, CMaps, wasm), lida do disco pelo próprio pdfjs no Node. */
function pastaPdfjs(sub: string): string {
  return join(process.cwd(), "node_modules", "pdfjs-dist", sub) + "/";
}

export async function abrirPdfServidor(bytes: Uint8Array): Promise<PdfServidor> {
  const { pdfjs, createCanvas } = await carregarDesenhador();
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(bytes), // cópia: o pdfjs pode transferir/alterar o buffer
    useSystemFonts: false,
    standardFontDataUrl: pastaPdfjs("standard_fonts"),
    cMapUrl: pastaPdfjs("cmaps"),
    cMapPacked: true,
    wasmUrl: pastaPdfjs("wasm"),
    verbosity: 0,
    // Sem `isEvalSupported`: o pdfjs 6.4 tirou a opção e não usa eval/new Function em lugar nenhum.
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
        const tamanho = tamanhoDesenho(n, viewport.width, viewport.height); // antes de criar o canvas
        const canvas = createCanvas(tamanho.largura, tamanho.altura);
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
