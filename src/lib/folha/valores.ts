// Regras puras do valor da prova e de cada questão. Tudo em décimos inteiros (10,0 = 100),
// sem ponto flutuante. Sem banco e sem APIs do Node (também roda no navegador).

/** "10", "7,5" ou "7.5" em décimos; null se vazio, não numérico, <= 0, > 1000 ou com mais de 1 casa. */
export function lerDecimos(texto: string | null | undefined): number | null {
  const t = (texto ?? "").trim();
  const m = /^(\d+)(?:[.,](\d))?$/.exec(t);
  if (!m) return null;
  const d = Number(m[1]) * 10 + Number(m[2] ?? 0);
  return d > 0 && d <= 10000 ? d : null;
}

/** 100 vira "10,0"; 5 vira "0,5". */
export function formatarDecimos(d: number): string {
  return `${Math.floor(d / 10)},${d % 10}`;
}

export type ValoresProva = { porQuestao: (number | null)[] | null; aviso: string | null };

/**
 * Valor de cada questão, em décimos. `fixos` é posicional (null = automática). As automáticas
 * dividem o que sobra: base = ⌊resto/n⌋ e a sobra vira +0,1 nas últimas automáticas.
 * Sem total, desligado ou fixos acima do total: nenhum valor por questão.
 */
export function valoresDasQuestoes(totalDecimos: number | null, fixos: (number | null)[], mostrar: boolean): ValoresProva {
  if (!mostrar || totalDecimos === null) return { porQuestao: null, aviso: null };
  const somaFixos = fixos.reduce<number>((s, v) => s + (v ?? 0), 0);
  if (somaFixos > totalDecimos) {
    return {
      porQuestao: null,
      aviso: `Os valores fixos (${formatarDecimos(somaFixos)}) passam do valor da prova (${formatarDecimos(totalDecimos)}).`,
    };
  }
  const automaticas = fixos.filter((v) => v === null).length;
  if (automaticas === 0) {
    return {
      porQuestao: [...fixos],
      aviso:
        somaFixos === totalDecimos
          ? null
          : `As questões somam ${formatarDecimos(somaFixos)} e a prova vale ${formatarDecimos(totalDecimos)}.`,
    };
  }
  const resto = totalDecimos - somaFixos;
  const base = Math.floor(resto / automaticas);
  const sobra = resto % automaticas;
  let vistas = 0;
  const porQuestao = fixos.map((v) => {
    if (v !== null) return v;
    vistas++;
    return base + (vistas > automaticas - sobra ? 1 : 0);
  });
  return { porQuestao, aviso: null };
}

/** Valida os valores fixos pedidos (Hermes e site); total e itens em décimos. Devolve `fixos` posicional. */
export function validarValoresPedido(
  n: number,
  total: number | null,
  itens: { numero: number; valor: number }[],
): { ok: true; fixos: (number | null)[] } | { ok: false; erro: string } {
  const fixos: (number | null)[] = Array.from({ length: n }, () => null);
  if (itens.length === 0) return { ok: true, fixos };
  if (total === null) return { ok: false, erro: "Informe o valor da prova antes de definir o valor das questões." };
  let soma = 0;
  for (const it of itens) {
    if (!Number.isInteger(it.numero) || it.numero < 1 || it.numero > n) {
      return { ok: false, erro: `A questão ${it.numero} não existe na prova (de 1 a ${n}).` };
    }
    if (fixos[it.numero - 1] !== null) return { ok: false, erro: `A questão ${it.numero} aparece mais de uma vez.` };
    if (!Number.isInteger(it.valor) || it.valor < 1) {
      return { ok: false, erro: `O valor da questão ${it.numero} deve ser maior que zero.` };
    }
    fixos[it.numero - 1] = it.valor;
    soma += it.valor;
  }
  if (soma > total) {
    return {
      ok: false,
      erro: `Os valores fixos (${formatarDecimos(soma)}) passam do valor da prova (${formatarDecimos(total)}).`,
    };
  }
  return { ok: true, fixos };
}
