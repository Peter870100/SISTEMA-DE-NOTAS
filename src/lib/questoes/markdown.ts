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

function normalizar(s: string): string {
  return s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

/** O enunciado já termina com o comando? (a importação às vezes repete o comando no fim do texto) */
export function comandoRepetido(enunciado: string, comando: string): boolean {
  const c = normalizar(comando ?? "");
  return c.length > 0 && normalizar(enunciado ?? "").endsWith(c);
}

/**
 * Células de uma linha de tabela em markdown ("| a | b |" → ["a", "b"]); a linha separadora ("|---|---|")
 * devolve []; linha que não é de tabela devolve null.
 */
export function celulasTabela(linha: string): string[] | null {
  const t = linha.trim();
  if (t.length < 2 || !t.startsWith("|") || !t.endsWith("|")) return null;
  const celulas = t.slice(1, -1).split("|").map((c) => c.trim());
  return celulas.every((c) => /^:?-{3,}:?$/.test(c)) ? [] : celulas;
}

/** Comando a mostrar depois do enunciado: vazio quando o enunciado já termina com ele. */
export function comandoParaMostrar(enunciado: string, comando: string): string {
  return comandoRepetido(enunciado, comando) ? "" : comando;
}

export type ParteTexto = { tipo: "linha"; segmentos: Segmento[] } | { tipo: "tabela"; linhas: string[][] };

/** Linhas do markdown com as linhas seguidas de tabela ("| a | b |") juntas numa tabela; `semTabelas` as descarta. */
export function partesDoTexto(texto: string, semTabelas = false): ParteTexto[] {
  const partes: ParteTexto[] = [];
  for (const segmentos of markdownParaBlocos(texto)) {
    const celulas = celulasTabela(segmentos.map((s) => s.texto).join(""));
    if (!celulas) {
      partes.push({ tipo: "linha", segmentos });
      continue;
    }
    if (semTabelas || !celulas.length) continue;
    const anterior = partes.at(-1);
    if (anterior?.tipo === "tabela") anterior.linhas.push(celulas);
    else partes.push({ tipo: "tabela", linhas: [celulas] });
  }
  return partes;
}
