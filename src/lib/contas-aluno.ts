import { randomInt } from "node:crypto";

const ALFABETO_SENHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function sortear(alfabeto: string, tamanho: number): string {
  let saida = "";
  for (let i = 0; i < tamanho; i++) saida += alfabeto[randomInt(alfabeto.length)];
  return saida;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * `primeironome.ultimosobrenome`, sem acento e minúsculo. Se já existir em `existentes`,
 * acrescenta 2, 3… O escolhido entra em `existentes`, então um lote com nomes iguais
 * nunca repete usuário.
 */
export function sugerirUsuario(nome: string, existentes: Set<string>): string {
  const partes = semAcento(nome)
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const base = partes.length === 0 ? "aluno" : partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`;

  let candidato = base;
  for (let n = 2; existentes.has(candidato); n++) candidato = `${base}${n}`;
  existentes.add(candidato);
  return candidato;
}

export function gerarSenhaProvisoria(): string {
  return sortear(ALFABETO_SENHA, 8);
}

export function gerarCodigoConvite(): string {
  return sortear(ALFABETO_CODIGO, 6);
}

export { formatarCodigo, normalizarCodigo } from "./codigo-convite";

export function normalizarIdentificador(entrada: string): string {
  return entrada.trim().toLowerCase();
}

export function ehEmail(identificador: string): boolean {
  return identificador.includes("@");
}
