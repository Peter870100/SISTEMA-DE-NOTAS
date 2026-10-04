import { obterEscolaPadrao } from "@/lib/escolas";

/** Código de convite exigido no cadastro público de professor (por escola). */
export async function obterCodigoConvite(): Promise<string | null> {
  const escola = await obterEscolaPadrao();
  return escola.codigo_convite_professor;
}
