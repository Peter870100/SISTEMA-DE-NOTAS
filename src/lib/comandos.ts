/** Lógica pura da paleta de comandos (Ctrl+K) — sem React, testada em comandos.test.ts. */

export type ItemComando = {
  id: string;
  grupo: "Alunos" | "Turmas" | "Ações";
  rotulo: string;
  detalhe?: string;
  palavrasChave?: string[];
  executar: () => void;
};

/** Minúsculas e sem acento, pra "José" casar com "jose". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarComandos(itens: ItemComando[], termo: string): ItemComando[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return itens;
  const pontuados: { item: ItemComando; pontos: number; ordem: number }[] = [];
  itens.forEach((item, ordem) => {
    const rotulo = normalizar(item.rotulo);
    const extras = (item.palavrasChave ?? []).map(normalizar);
    if (rotulo.startsWith(alvo)) pontuados.push({ item, pontos: 0, ordem });
    else if (rotulo.includes(alvo) || extras.some((p) => p.includes(alvo))) pontuados.push({ item, pontos: 1, ordem });
  });
  return pontuados.sort((a, b) => a.pontos - b.pontos || a.ordem - b.ordem).map((p) => p.item);
}

export function trechosDestacados(texto: string, termo: string): { texto: string; destaque: boolean }[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return [{ texto, destaque: false }];

  // Normaliza caractere a caractere, guardando de qual índice do original veio cada caractere normalizado.
  const chars = Array.from(texto);
  let normalizado = "";
  const origem: number[] = [];
  let posicao = 0;
  for (const ch of chars) {
    const n = normalizar(ch);
    for (let k = 0; k < n.length; k++) origem.push(posicao);
    normalizado += n;
    posicao += ch.length;
  }

  const idx = normalizado.indexOf(alvo);
  if (idx === -1) return [{ texto, destaque: false }];
  const inicio = origem[idx];
  const ultimo = origem[idx + alvo.length - 1];
  const fim = ultimo + Array.from(texto.slice(ultimo))[0].length;

  const partes: { texto: string; destaque: boolean }[] = [];
  if (inicio > 0) partes.push({ texto: texto.slice(0, inicio), destaque: false });
  partes.push({ texto: texto.slice(inicio, fim), destaque: true });
  if (fim < texto.length) partes.push({ texto: texto.slice(fim), destaque: false });
  return partes;
}
