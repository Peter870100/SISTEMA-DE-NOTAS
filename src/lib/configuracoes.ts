import { obterEscola } from "@/lib/escolas";

/** Código de convite exigido no cadastro público de professor, da escola dada. */
export async function obterCodigoConvite(escolaId: string): Promise<string | null> {
  const escola = await obterEscola(escolaId);
  return escola.codigo_convite_professor;
}
