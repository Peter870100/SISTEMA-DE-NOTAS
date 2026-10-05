import { escolaDoEndereco, obterEscola } from "@/lib/escolas";
import { MARCA_PADRAO, marcaDaEscola, type MarcaEscola } from "@/lib/marca";

/** Marca da escola do endereço desta requisição (telas públicas). Falha ou endereço sem escola = marca padrão. */
export async function marcaDoEndereco(): Promise<MarcaEscola> {
  try {
    const escola = await escolaDoEndereco();
    return escola ? marcaDaEscola(escola) : MARCA_PADRAO;
  } catch {
    return MARCA_PADRAO;
  }
}

/** Marca da escola de uma conta logada (telas que exigem sessão). */
export async function marcaDaConta(escolaId: string): Promise<MarcaEscola> {
  try {
    return marcaDaEscola(await obterEscola(escolaId));
  } catch {
    return MARCA_PADRAO;
  }
}
