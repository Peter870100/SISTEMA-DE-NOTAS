import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { criarSupabaseClient, registrarFerramentas } from "../src/lib/mcp-tools";
import { contextoPlanilha, depsDoBanco } from "../src/lib/mcp/planilha-contexto";

const supabase = criarSupabaseClient();
const server = new McpServer({ name: "planilha-viva", version: "1.0.0" });
registrarFerramentas(server, supabase, (args) => contextoPlanilha("professor", args, depsDoBanco(supabase)), "professor");

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
