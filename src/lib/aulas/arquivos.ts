export const TAMANHO_MAXIMO_PDF = 26214400;

/** Mensagem de erro para o arquivo, ou null se pode ser enviado. */
export function validarArquivo(nome: string, tamanho: number): string | null {
  if (!/\.pdf$/i.test(nome.trim())) return "Envie apenas arquivos PDF.";
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "O arquivo está vazio.";
  if (tamanho > TAMANHO_MAXIMO_PDF) return "O arquivo passa de 25 MB.";
  return null;
}

export function caminhoArquivo(escolaId: string, cursoId: string, aulaId: string, uuid: string): string {
  return `${escolaId}/${cursoId}/${aulaId}/${uuid}.pdf`;
}
