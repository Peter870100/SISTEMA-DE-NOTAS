// O pdfjs-dist não publica tipos para o worker; só usamos o módulo inteiro como `globalThis.pdfjsWorker`.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
