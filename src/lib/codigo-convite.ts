// sem dependência de Node: o modal do professor (cliente) usa
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatarCodigo(codigo: string): string {
  return `${codigo.slice(0, 3)}-${codigo.slice(3)}`;
}
