import { lerFiltrosApi, tokenApiValido } from "@/lib/questoes/api-questoes";
import { listarQuestoesApi } from "@/lib/questoes/api-questoes-servidor";

export const runtime = "nodejs";

/** GET /api/questoes?banca=UFMS,UEMS&ano=2026&materia=matematica&area=natureza&assunto=<id>&pagina=1&limite=50 */
export async function GET(req: Request): Promise<Response> {
  if (!tokenApiValido(req.headers.get("authorization"))) return Response.json({ erro: "Chave inválida." }, { status: 401 });
  const filtros = lerFiltrosApi(new URL(req.url).searchParams);
  if ("erro" in filtros) return Response.json(filtros, { status: 400 });
  try {
    return Response.json(await listarQuestoesApi(filtros));
  } catch (e) {
    console.error("api/questoes", e);
    return Response.json({ erro: "Falha ao consultar as questões." }, { status: 500 });
  }
}
