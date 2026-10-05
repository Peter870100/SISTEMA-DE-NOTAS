import { armazenamentoCapas } from "./capas-armazenamento";
import type { Professor } from "@/lib/types";
import { assinaturaImagemValida, caminhoCapaValido, LIMITE_CAPA, type TipoCapa } from "./capas";
export async function validarCapaEnviada(caminho: string | null | undefined, anterior: string | null | undefined, professor: Professor, tipo: TipoCapa) {
  if (caminho === undefined) return undefined;
  if (caminho === null) return null;
  if (caminho === anterior) return caminho;
  if (typeof caminho !== "string" || !caminhoCapaValido(caminho, professor.escola_id, professor.id, tipo)) throw new Error("Imagem inválida para esta conta.");
  const { data, error } = await armazenamentoCapas().download(caminho);
  if (error || !data) throw new Error("A imagem não foi enviada. Escolha o arquivo novamente.");
  if (!data.size || data.size > LIMITE_CAPA || !assinaturaImagemValida(new Uint8Array(await data.slice(0, 12).arrayBuffer()), caminho.split(".").pop()!)) throw new Error("Envie uma imagem PNG, JPG ou WebP válida, de até 2 MB.");
  return caminho;
}
export async function apagarCapaAnterior(anterior: string | null | undefined, atual: string | null | undefined) {
  if (atual !== undefined && anterior && anterior !== atual) {
    // Uma falha na limpeza não desfaz a imagem já salva no curso/aula.
    try { await armazenamentoCapas().remove([anterior]); } catch { /* Limpeza opcional de arquivo órfão. */ }
  }
}
