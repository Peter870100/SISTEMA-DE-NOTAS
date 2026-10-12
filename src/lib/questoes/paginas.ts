/** Lê "3", "1-3, 5" etc. Vazio = todas as páginas. Devolve números ordenados, sem repetir. */
export function lerPaginas(texto: string, total: number): number[] {
  const limpo = texto.trim();
  if (!limpo) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas = new Set<number>();
  for (const parte of limpo.split(/[,;\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Páginas inválidas: "${parte}". Use, por exemplo, 3 ou 1-3, 5.`);
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    const [de, ate] = a <= b ? [a, b] : [b, a];
    if (de < 1) throw new Error(`Páginas inválidas: "${parte}". A primeira página é a 1.`);
    if (ate > total) throw new Error(`O PDF tem ${total} páginas; a página ${ate} não existe.`);
    for (let n = de; n <= ate; n++) paginas.add(n);
  }
  return [...paginas].sort((x, y) => x - y);
}
