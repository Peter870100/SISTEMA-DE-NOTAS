// Decide se um Ctrl+V é uma imagem (print) ou texto. O Office no Windows põe um PNG do texto
// ao lado do text/html e do text/plain, e isso não pode virar figura.

/** Texto visível do HTML colado (sem tags, estilos, comentários nem espaços). */
function textoVisivel(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
}

export function colagemEhImagem({ temArquivoImagem, texto, html }: { temArquivoImagem: boolean; texto: string; html: string }): boolean {
  if (!temArquivoImagem) return false;
  if (texto.trim()) return false;
  return !textoVisivel(html);
}
