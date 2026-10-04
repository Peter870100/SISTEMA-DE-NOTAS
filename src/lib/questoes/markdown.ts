export type Segmento = { texto: string; negrito: boolean; italico: boolean };

/**
 * Markdown mínimo: **negrito**, *itálico* e quebras de linha. Não interpreta HTML —
 * tudo vira texto, e o componente renderiza com elementos React (escapados).
 * Marcação sem fechamento fica literal.
 */
export function markdownParaBlocos(texto: string): Segmento[][] {
  if (!texto) return [];
  return texto.split(/\r?\n/).map((linha) => {
    const segmentos: Segmento[] = [];
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let ultimo = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(linha))) {
      if (m.index > ultimo) segmentos.push({ texto: linha.slice(ultimo, m.index), negrito: false, italico: false });
      segmentos.push(m[1] !== undefined ? { texto: m[1], negrito: true, italico: false } : { texto: m[2], negrito: false, italico: true });
      ultimo = re.lastIndex;
    }
    if (ultimo < linha.length) segmentos.push({ texto: linha.slice(ultimo), negrito: false, italico: false });
    return segmentos;
  });
}
