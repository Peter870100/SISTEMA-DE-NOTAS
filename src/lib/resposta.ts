/** Resposta de server action com erro como valor (ver `Resposta` em `src/actions/lixeira.ts`). */
type RespostaAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * No cliente: os dados da resposta, ou lança um `Error` com a mensagem do servidor (erro lançado no
 * cliente mantém a mensagem, ao contrário do lançado dentro da server action em produção).
 */
export function dadosOuErro<T>(r: RespostaAcao<T>): T {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}
