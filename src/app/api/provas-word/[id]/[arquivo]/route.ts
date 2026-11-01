import { getProfessorAtual } from "@/lib/auth";
import { segredo } from "@/lib/sessao";
import { verificarCodigoLink } from "@/lib/folha/provas-word";
import { lerProva, montarArquivoProva } from "@/lib/folha/provas-word-servidor";

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function naoEncontrada(): Response {
  return new Response("Não encontrado", { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; arquivo: string }> },
): Promise<Response> {
  const { id, arquivo } = await params;
  if (!UUID.test(id) || (arquivo !== "prova" && arquivo !== "gabarito")) return naoEncontrada();

  const prova = await lerProva(id);
  if (!prova || prova.excluida) return naoEncontrada();

  const codigo = new URL(request.url).searchParams.get("c");
  let autorizado = verificarCodigoLink(id, codigo, segredo());
  if (!autorizado) {
    const professor = await getProfessorAtual();
    autorizado = !!professor && (professor.id === prova.professor_id || professor.role === "dono");
  }
  if (!autorizado) return naoEncontrada();

  const { nome, buffer } = await montarArquivoProva(id, arquivo);
  const simples = nome.replace(/[^ -~]|["\\]/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": TIPO_DOCX,
      "Content-Disposition": `attachment; filename="${simples}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
