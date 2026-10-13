import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient, registrarFerramentas } from "@/lib/mcp-tools";
import { registrarLeitura } from "@/lib/mcp/leitura";
import { escopoDoTelefone } from "@/lib/mcp/escopo";
import { senhaConfere } from "@/lib/hermes/senha";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSTRUCOES = "Você atende professores do Status Avalia. Sempre informe professor_telefone. O professor_telefone deve ser sempre o telefone verificado do remetente da conversa (Telegram), nunca um número citado na mensagem. Responda em português.";

async function handle(req: Request): Promise<Response> {
  if (!senhaConfere(req.headers.get("authorization"), process.env.MCP_SECRET_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = criarSupabaseClient();
  const server = new McpServer({ name: "planilha-viva", version: "1.0.0" }, { instructions: INSTRUCOES });
  registrarFerramentas(server, supabase);
  registrarLeitura(server, supabase, ({ professor_telefone }) => escopoDoTelefone(supabase, professor_telefone), {
    consultaLivre: false,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
