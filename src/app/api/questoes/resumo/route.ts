import { tokenApiValido } from "@/lib/questoes/api-questoes";
import { resumoApi } from "@/lib/questoes/api-questoes-servidor";

export const runtime = "nodejs";

/** GET /api/questoes/resumo: quantas questões publicadas há por banca e ano. */
export async function GET(req: Request): Promise<Response> {
  if (!tokenApiValido(req.headers.get("authorization"))) return Response.json({ erro: "Chave inválida." }, { status: 401 });
  try {
    return Response.json(await resumoApi());
  } catch (e) {
    console.error("api/questoes/resumo", e);
    return Response.json({ erro: "Falha ao consultar o resumo." }, { status: 500 });
  }
}
