/** Padrão para ilike que casa o texto inteiro sem diferenciar maiúsculas ("ufms" acha "UFMS"). */
export function padraoExato(texto: string): string {
  return texto.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}
