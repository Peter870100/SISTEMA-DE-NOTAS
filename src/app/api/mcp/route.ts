import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { criarSupabaseClient, registrarFerramentas } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

function autorizado(req: Request): boolean {
  const header = req.headers.get("authorization");
  const esperado = process.env.MCP_SECRET_TOKEN;
  return !!esperado && header === `Bearer ${esperado}`;
}

async function handle(req: Request): Promise<Response> {
  if (!autorizado(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = criarSupabaseClient();
  const server = new McpServer({ name: "planilha-viva", version: "1.0.0" });
  registrarFerramentas(server, supabase);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
