// Distribui blocos medidos em páginas de duas colunas. Puro: sem DOM.

export type BlocoMedido = { altura: number; grudaNoProximo: boolean };

export type PaginaPrevia = {
  colunas: [number[], number[]];
  // índice do bloco -> altura máxima (bloco maior que a coluna)
  reduzir: Record<number, number>;
};

export function paginar(
  blocos: BlocoMedido[],
  alturaPrimeira: number,
  alturaDemais: number,
): PaginaPrevia[] {
  const paginas: PaginaPrevia[] = [{ colunas: [[], []], reduzir: {} }];
  let coluna = 0;
  let usado = 0;

  const alturaColuna = () => (paginas.length === 1 ? alturaPrimeira : alturaDemais);
  const avancar = () => {
    if (coluna === 0) coluna = 1;
    else {
      paginas.push({ colunas: [[], []], reduzir: {} });
      coluna = 0;
    }
    usado = 0;
  };

  // blocos da cabeça de uma cadeia desfeita: seguem as regras de bloco comum
  const soltos = new Set<number>();
  let i = 0;
  while (i < blocos.length) {
    // fim da cadeia que começa em i (blocos com grudaNoProximo + o próximo)
    let fim = i;
    while (fim < blocos.length - 1 && blocos[fim].grudaNoProximo && !soltos.has(fim)) fim++;
    let total = 0;
    for (let k = i; k <= fim; k++) total += blocos[k].altura;

    const limite = alturaColuna();
    if (usado + total <= limite) {
      const pag = paginas[paginas.length - 1];
      for (let k = i; k <= fim; k++) pag.colunas[coluna].push(k);
      usado += total;
      i = fim + 1;
      continue;
    }

    // não cabe: vai para o topo de uma coluna vazia
    if (usado > 0) {
      avancar();
      continue;
    }

    // cadeia (ou bloco) maior que uma coluna vazia: fica inteira no topo da
    // coluna e o último bloco é reduzido ao espaço que sobra
    const pag = paginas[paginas.length - 1];
    const cabeca = total - blocos[fim].altura;
    const restante = limite - cabeca;
    if (restante >= limite * 0.3) {
      for (let k = i; k <= fim; k++) pag.colunas[coluna].push(k);
      pag.reduzir[fim] = restante;
      usado = limite;
      i = fim + 1;
    } else {
      // cabeça alta demais: desfaz a cadeia; cada bloco segue as regras comuns
      // (sempre solta ao menos um bloco, então termina)
      for (let k = i; k < fim; k++) soltos.add(k);
    }
  }
  return paginas;
}
