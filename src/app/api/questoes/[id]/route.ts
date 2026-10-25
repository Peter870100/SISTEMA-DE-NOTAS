import { tokenApiValido } from "@/lib/questoes/api-questoes";
import { questaoApiPorId } from "@/lib/questoes/api-questoes-servidor";

export const runtime = "nodejs";

/** GET /api/questoes/<id>: uma questão publicada do banco geral. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!tokenApiValido(req.headers.get("authorization"))) return Response.json({ erro: "Chave inválida." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ erro: "Questão não encontrada." }, { status: 404 });
  try {
    const questao = await questaoApiPorId(id);
    return questao ? Response.json(questao) : Response.json({ erro: "Questão não encontrada." }, { status: 404 });
  } catch (e) {
    console.error("api/questoes/[id]", e);
    return Response.json({ erro: "Falha ao consultar a questão." }, { status: 500 });
  }
}
